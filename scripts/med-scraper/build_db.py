#!/usr/bin/env python3
"""
Build the medicaments database.

  catalogue     : medicament.ma (scraped JSONL)
  remboursement : CNSS + CNOPS official lists (JSONL)

Outputs
  out/medicaments_ma.sqlite   ready-to-query SQLite database
  out/medicaments_ma.sql      portable INSERT script (SQLite / PostgreSQL)
  out/quality_report.txt      field coverage + matching statistics
"""
import argparse
import datetime
import json
import os
import re
import sqlite3
from collections import defaultdict

from normalize import (COUNTED_UNITS, dose_key, form_key, money, norm, norm_name,
                       parse_doses, parse_fr_date, pres_signature, unit_kind)

# Rates as published by the two organisations themselves.
REGIMES = [
    ("CNSS", "Assurance Maladie Obligatoire - secteur prive",
     "Salaries du secteur prive, TNS, AMO Tadamon/Achamil et leurs ayants droit",
     70.00, 100.00, "PPV - BR (base de remboursement)",
     "https://www.cnss.ma/fr/listes-des-medicaments",
     "La CNSS publie le taux applique produit par produit (colonne "
     "« Taux Rembours ») : 70% pour les medicaments admis, 0% sinon. "
     "100% de la base pour les ALD/ALC prises en charge."),
    ("CNOPS", "Assurance Maladie Obligatoire - secteur public",
     "Fonctionnaires et agents de l'Etat et leurs ayants droit",
     70.00, 100.00, "PRIX_PBR (base de remboursement)",
     "https://www.cnops.org.ma/fr/medicaments",
     "Decret 2.05-736 : 70% du PPV pour l'ambulatoire, sur la base du prix du "
     "generique s'il existe ; 100% pour une ALD/ALC declaree avec exoneration "
     "du ticket moderateur. La couverture mutualiste complementaire ajoute "
     "16 a 20%."),
]

DETAIL_MAP = {
    "Presentation": "presentation",
    "Dosage": "dosage",
    "Composition": "composition",
    "Statut": "statut",
    "Tableau": "tableau",
    "Nature du Produit": "nature",
    "Code ATC": "atc_code",
    "Indication(s)": "indications",
    "Contres-indication(s)": "contre_indications",
    "Posologies et mode d administration": "posologie",
    "Mises en garde": "mises_en_garde",
    "Effets indesirable": "effets_indesirables",
    "Grossesse": "grossesse",
    "Allaitement": "allaitement",
    "Conservation": "conservation",
}


def label_key(s):
    """Detail-page labels vary in accents and apostrophes; flatten both."""
    return re.sub(r"[^A-Z0-9]+", " ", norm(s)).strip()


DETAIL_MAP_NORM = {label_key(k): v for k, v in DETAIL_MAP.items()}
LABEL_PPV = label_key("PPV")
LABEL_PH = label_key("Prix hospitalier")
LABEL_PPC = label_key("PPC")
LABEL_LAB = label_key("Distributeur ou fabriquant")
LABEL_CLASS = label_key("Classe therapeutique")
LABEL_PRINCEPS = label_key("Princeps")
LABEL_NOTICE = label_key("Notice en francais")
LABEL_LIEN = label_key("Lien du Produit")

BRACKET_RE = re.compile(r"\s*\[[^\]]{1,6}\]")
STRENGTH_TAIL_RE = re.compile(r"\s+\d[\d.,]*\s*(MG|G|UG|ML|UI|%|MCG|µG).*$", re.I)
STRENGTH_RE = re.compile(
    r"\d[\d.,]*\s*(?:MG|G|UG|µG|MCG|ML|UI|%)"
    r"(?:\s*/\s*\d[\d.,]*\s*(?:MG|G|UG|µG|MCG|ML|UI|%))*", re.I)


class Dim:
    """Auto-incrementing dimension table keyed on a normalised name."""

    def __init__(self):
        self.by_norm = {}
        self.rows = []

    def get(self, name, extra=None):
        if not name:
            return None
        key = norm(name)
        if not key:
            return None
        if key not in self.by_norm:
            new_id = len(self.rows) + 1
            self.by_norm[key] = new_id
            self.rows.append((new_id, str(name).strip(), key, extra))
        return self.by_norm[key]


def load_jsonl(path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)


# ---------------------------------------------------------------------------
# catalogue
# ---------------------------------------------------------------------------

def build_medicaments(scraped_paths):
    labs, classes, subs = Dim(), Dim(), Dim()
    meds, med_subs = [], []
    seen_ids, seen_slugs = set(), set()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

    for path in scraped_paths:
        for r in load_jsonl(path):
            mid, slug = r.get("site_id"), r.get("slug")
            if not mid or not slug or mid in seen_ids or slug in seen_slugs:
                continue
            seen_ids.add(mid)
            seen_slugs.add(slug)

            d = {label_key(k): v for k, v in (r.get("details") or {}).items()}
            vals = {col: d.get(lbl) for lbl, col in DETAIL_MAP_NORM.items()}

            atc = (vals.get("atc_code") or "").strip().upper() or None
            tags = r.get("tags") or []
            flags = r.get("title_flags") or []
            is_princeps = int("Princeps" in tags or d.get(LABEL_PRINCEPS) == "Oui" or "P" in flags)
            is_generique = 0 if is_princeps else int(any(norm(t) == "GENERIQUE" for t in tags))

            composition = vals.get("composition") or ""
            dosage = vals.get("dosage") or ""
            if not dosage:
                mstr = STRENGTH_RE.search(r.get("brand_label") or "")
                if mstr:
                    dosage = mstr.group(0).strip()
            comp_parts = [c.strip() for c in composition.split("|") if c.strip()]
            dose_parts = [c.strip() for c in dosage.split("|") if c.strip()]

            dci_key = "+".join(sorted(filter(None, (norm_name(c) for c in comp_parts))))
            dk = dose_key(dosage)
            fk = form_key(r.get("form") or "")
            equiv_key = "{}|{}|{}".format(dci_key, dk, fk) if dci_key and dk else ""

            pres = vals.get("presentation") or ""
            pack_count, pres_vol = pres_signature(pres, r.get("form"))
            unite = unit_kind(pres, r.get("form"))
            brand_label = r.get("brand_label") or ""
            brand = STRENGTH_TAIL_RE.sub("", brand_label).strip() or brand_label
            ppv = money(d.get(LABEL_PPV))

            meds.append({
                "id": mid,
                "slug": slug,
                "url": r["url"],
                "name": BRACKET_RE.sub("", r.get("title") or "").strip(),
                "brand": brand,
                "form": r.get("form"),
                "form_key": fk,
                "dosage": dosage or None,
                "dose_key": dk or None,
                "presentation": pres or None,
                "pack_size": pack_count,
                "pres_vol_ml": pres_vol,
                "unite_conditionnement": unite,
                # a per-unit price only means something when the pack counts
                # discrete units; "per bottle" is not comparable to "per tablet".
                "ppv_unitaire": (round(ppv / pack_count, 4)
                                 if ppv and pack_count and unite in COUNTED_UNITS else None),
                "laboratory_id": labs.get(d.get(LABEL_LAB), r.get("lab_url")),
                "therapeutic_class_id": classes.get(d.get(LABEL_CLASS)),
                "atc_code": atc,
                "atc_niveau1": atc[0] if atc else None,
                "atc_niveau3": atc[:4] if atc and len(atc) >= 4 else None,
                "atc_niveau4": atc[:5] if atc and len(atc) >= 5 else None,
                "composition": composition or None,
                "dci_key": dci_key,
                "equiv_key": equiv_key,
                "statut": vals.get("statut"),
                "tableau": vals.get("tableau"),
                "nature": vals.get("nature"),
                "is_princeps": is_princeps,
                "is_generique": is_generique,
                "ppv": ppv,
                "prix_hospitalier": money(d.get(LABEL_PH)),
                "ppc": money(d.get(LABEL_PPC)),
                "indications": vals.get("indications"),
                "contre_indications": vals.get("contre_indications"),
                "posologie": vals.get("posologie"),
                "mises_en_garde": vals.get("mises_en_garde"),
                "effets_indesirables": vals.get("effets_indesirables"),
                "grossesse": vals.get("grossesse"),
                "allaitement": vals.get("allaitement"),
                "conservation": vals.get("conservation"),
                "notice_url": d.get(LABEL_NOTICE) or d.get(LABEL_LIEN),
                "date_maj": parse_fr_date(r.get("updated_label")),
                "date_ajout": parse_fr_date(r.get("added_label")),
                "scraped_at": now,
            })

            for i, cname in enumerate(comp_parts):
                sid = subs.get(cname)
                if sid is None:
                    continue
                dtxt = dose_parts[i] if i < len(dose_parts) else None
                pd = parse_doses(dtxt)
                dval, dunit = (pd[0] if pd else (None, None))
                # a unitless 10+ digit "dosage" is a barcode typed into the
                # wrong field upstream, not a strength
                if dval is not None and not dunit and dval >= 1e9:
                    dval, dtxt = None, None
                med_subs.append((mid, sid, i, dtxt, dval, dunit))

    return labs, classes, subs, meds, med_subs


# ---------------------------------------------------------------------------
# official reimbursement lists
# ---------------------------------------------------------------------------

def _remb_row(regime, ean, nom, dci, lab, forme, dosage, unite, presentation,
              classe, ppv, ph, base, taux, remboursable, categorie,
              code_groupe=None, code_princeps=None):
    pack, vol = pres_signature(presentation, forme)
    dose_txt = "{} {}".format(dosage or "", unite or "").strip()
    return {
        "regime": regime, "ean13": ean, "nom": nom, "nom_norm": norm_name(nom),
        "dci": dci, "dci_norm": norm_name(dci), "laboratoire": lab,
        "forme": forme, "dosage": dosage, "unite_dosage": unite,
        "dose_key": dose_key(dose_txt), "presentation": presentation,
        "pack_size": pack, "pres_vol_ml": vol,
        "unite_conditionnement": unit_kind(presentation, forme),
        "classe_therapeutique": classe,
        "ppv": ppv, "prix_hospitalier": ph, "base_remboursement": base,
        "taux": taux, "remboursable": remboursable, "categorie": categorie,
        "code_groupe": code_groupe, "code_princeps": code_princeps,
    }


def _keep_better(store, row):
    """
    The same EAN can be listed twice (re-listings). Keep the row that actually
    carries a rate and a base, so a duplicate can never hide a reimbursable
    product behind a 0% twin.
    """
    prev = store.get(row["ean13"])
    rank = (row["remboursable"], row["base_remboursement"] is not None)
    if prev is None or rank > (prev["remboursable"], prev["base_remboursement"] is not None):
        store[row["ean13"]] = row


def build_cnss(path):
    best = {}
    for r in load_jsonl(path):
        ean = (r.get("Code") or "").strip()
        if not ean:
            continue
        taux = money(r.get("Taux Rembours"))
        _keep_better(best, _remb_row(
            "CNSS", ean, r.get("Nom") or "", r.get("DCI"), r.get("Laboratoire"),
            r.get("Forme"), r.get("Dosage"), r.get("Unite Dosage") or r.get("Unité Dosage"),
            r.get("Presentation") or r.get("Présentation"),
            r.get("Classe Therapeutique") or r.get("Classe Thérapeutique"),
            money(r.get("PPV")), money(r.get("PH")), money(r.get("PPV - BR")), taux,
            1 if (taux or 0) > 0 else 0,
            r.get("Princeps / Generique") or r.get("Princeps / Générique")))
    return list(best.values())


def build_cnops(path):
    """CNOPS rows, including the official substitution group (CODE_GROUPE)."""
    best = {}
    for r in load_jsonl(path):
        ean = (r.get("CODE") or "").strip()
        if not ean:
            continue
        remb = 1 if (r.get("REMBOURSABLE") or "").strip().upper() == "OUI" else 0
        _keep_better(best, _remb_row(
            "CNOPS", ean, r.get("LIBELLE") or "", r.get("DCI"), None,
            r.get("FORME"), r.get("DOSAGE"), r.get("UNITE_DOSAGE"),
            r.get("PRESENTATION"), None,
            money(r.get("PRIX_PPV")), None, money(r.get("PRIX_PBR")),
            None, remb, r.get("PRINCEPS"),
            r.get("CODE_GROUPE"), r.get("CODE_PRINCEPS")))
    return list(best.values())


def match_official(meds, remb_rows):
    """
    Attach each catalogue product to its row in each official list.

    Name is the anchor; dosage and pack size decide. The same brand is listed
    several times per organisation (boite de 10 vs 30, flacon de 10 ml vs
    20 ml) with a different base each time, so accepting a candidate on the
    name alone would produce a wrong refund.
    """
    by_regime_nom = defaultdict(lambda: defaultdict(list))
    for r in remb_rows:
        by_regime_nom[r["regime"]][r["nom_norm"]].append(r)

    links = []
    for m in meds:
        brand_norm = norm_name(m["brand"])
        if not brand_norm:
            continue
        for regime, index in by_regime_nom.items():
            cands = index.get(brand_norm)
            if not cands:
                continue
            best, score, method = None, -1.0, ""
            for g in cands:
                same_dose = bool(m["dose_key"] and g["dose_key"] and m["dose_key"] == g["dose_key"])
                same_pack = bool(m["pack_size"] and g["pack_size"] and m["pack_size"] == g["pack_size"])
                both_vol = m["pres_vol_ml"] is not None and g["pres_vol_ml"] is not None
                same_vol = both_vol and abs(m["pres_vol_ml"] - g["pres_vol_ml"]) < 0.01
                same_ppv = bool(m["ppv"] and g["ppv"] and abs(m["ppv"] - g["ppv"]) < 0.011)

                s_, bits = 40.0, ["nom"]
                if same_dose:
                    s_ += 30.0
                    bits.append("dosage")
                if same_pack:
                    s_ += 20.0
                    bits.append("conditionnement")
                if same_vol:
                    s_ += 10.0
                elif both_vol:
                    s_ -= 35.0
                if same_ppv:
                    s_ += 5.0
                    bits.append("ppv")
                if s_ > score:
                    best, score, method = g, s_, "+".join(bits)
            if best:
                links.append((m["id"], regime, best["ean13"], round(score, 2), method))
    return links


# ---------------------------------------------------------------------------
# persistence
# ---------------------------------------------------------------------------

MED_COLS = [
    "id", "slug", "url", "name", "brand", "form", "form_key", "dosage", "dose_key",
    "presentation", "pack_size", "pres_vol_ml", "unite_conditionnement",
    "ppv_unitaire", "laboratory_id",
    "therapeutic_class_id", "atc_code", "atc_niveau1", "atc_niveau3", "atc_niveau4",
    "composition", "dci_key", "equiv_key", "statut", "tableau", "nature",
    "is_princeps", "is_generique", "ppv", "prix_hospitalier", "ppc", "indications",
    "contre_indications", "posologie", "mises_en_garde", "effets_indesirables",
    "grossesse", "allaitement", "conservation", "notice_url", "date_maj",
    "date_ajout", "scraped_at",
]
REMB_COLS = [
    "id", "regime", "ean13", "nom", "nom_norm", "dci", "dci_norm", "laboratoire",
    "forme", "dosage", "unite_dosage", "dose_key", "presentation", "pack_size",
    "pres_vol_ml", "unite_conditionnement", "classe_therapeutique", "ppv", "prix_hospitalier",
    "base_remboursement", "taux", "remboursable", "categorie", "code_groupe",
    "code_princeps",
]
REGIME_COLS = ["code", "name", "population", "taux_ambulatoire", "taux_ald",
               "base", "source_url", "note"]


def sql_literal(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def dump_sql(fh, table, cols, rows):
    fh.write("\n-- {}: {} rows\n".format(table, len(rows)))
    for r in rows:
        fh.write("INSERT INTO {} ({}) VALUES ({});\n".format(
            table, ", ".join(cols), ", ".join(sql_literal(v) for v in r)))


def persist(outdir, tag, schema_sql, labs, classes, subs, meds, med_subs, remb, links):
    sqlite_path = os.path.join(outdir, "medicaments_ma{}.sqlite".format(tag))
    sql_path = os.path.join(outdir, "medicaments_ma{}.sql".format(tag))

    med_rows = [tuple(m[c] for c in MED_COLS) for m in meds]
    remb_rows = [tuple(r[c] for c in REMB_COLS) for r in remb]
    lab_rows = labs.rows
    cls_rows = [(i, n, k) for i, n, k, _ in classes.rows]
    sub_rows = [(i, n, k) for i, n, k, _ in subs.rows]

    if os.path.exists(sqlite_path):
        os.remove(sqlite_path)
    con = sqlite3.connect(sqlite_path)
    con.executescript(schema_sql)
    con.executemany("INSERT INTO regime ({}) VALUES ({})".format(
        ",".join(REGIME_COLS), ",".join("?" * len(REGIME_COLS))), REGIMES)
    con.executemany("INSERT INTO laboratory (id,name,name_norm,url) VALUES (?,?,?,?)", lab_rows)
    con.executemany("INSERT INTO therapeutic_class (id,name,name_norm) VALUES (?,?,?)", cls_rows)
    con.executemany("INSERT INTO substance (id,name,name_norm) VALUES (?,?,?)", sub_rows)
    con.executemany("INSERT INTO medicament ({}) VALUES ({})".format(
        ",".join(MED_COLS), ",".join("?" * len(MED_COLS))), med_rows)
    con.executemany("INSERT INTO medicament_substance"
                    " (medicament_id,substance_id,position,dosage,dose_value,dose_unit)"
                    " VALUES (?,?,?,?,?,?)", med_subs)
    con.executemany("INSERT INTO remboursement ({}) VALUES ({})".format(
        ",".join(REMB_COLS), ",".join("?" * len(REMB_COLS))), remb_rows)
    con.executemany("INSERT INTO medicament_remboursement"
                    " (medicament_id,regime,ean13,match_score,match_method)"
                    " VALUES (?,?,?,?,?)", links)
    con.commit()

    with open(sql_path, "w", encoding="utf-8") as fh:
        fh.write("-- Generated by build_db.py on "
                 + datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
                 + "\n-- Catalogue: medicament.ma"
                   "\n-- Remboursement: CNSS (www.cnss.ma) et CNOPS (www.cnops.org.ma)\n\n")
        fh.write(schema_sql)
        fh.write("\n\n-- ==== data ====\n")
        dump_sql(fh, "regime", REGIME_COLS, REGIMES)
        dump_sql(fh, "laboratory", ["id", "name", "name_norm", "url"], lab_rows)
        dump_sql(fh, "therapeutic_class", ["id", "name", "name_norm"], cls_rows)
        dump_sql(fh, "substance", ["id", "name", "name_norm"], sub_rows)
        dump_sql(fh, "medicament", MED_COLS, med_rows)
        dump_sql(fh, "medicament_substance",
                 ["medicament_id", "substance_id", "position", "dosage",
                  "dose_value", "dose_unit"], med_subs)
        dump_sql(fh, "remboursement", REMB_COLS, remb_rows)
        dump_sql(fh, "medicament_remboursement",
                 ["medicament_id", "regime", "ean13", "match_score", "match_method"], links)

    return con, sqlite_path, sql_path


def quality_report(con, meds, remb, links, out_path):
    lines = []
    add = lines.append
    n = len(meds)
    add("=" * 78)
    add("RAPPORT QUALITE - base medicaments Maroc")
    add("  catalogue     : medicament.ma")
    add("  remboursement : CNSS (www.cnss.ma) + CNOPS (www.cnops.org.ma)")
    add("=" * 78)
    add("medicaments (catalogue)   : {}".format(n))
    for reg in ("CNSS", "CNOPS"):
        tot = sum(1 for r in remb if r["regime"] == reg)
        ok = sum(1 for r in remb if r["regime"] == reg and r["remboursable"] == 1)
        add("lignes {:<6}            : {:6d}  dont remboursables {}".format(reg, tot, ok))
    matched = {l[0] for l in links}
    add("medicaments rattaches     : {:6d}  ({:.1f}%)".format(
        len(matched), 100.0 * len(matched) / n if n else 0))
    add("")

    add("--- couverture des champs (catalogue) ---")
    for f in ["brand", "form", "dosage", "presentation", "composition", "atc_code",
              "laboratory_id", "therapeutic_class_id", "ppv", "prix_hospitalier",
              "pack_size", "ppv_unitaire", "indications", "posologie", "tableau",
              "nature", "date_maj"]:
        filled = sum(1 for m in meds if m.get(f) not in (None, "", []))
        add("  {:22s} {:6d} / {:<6d}  {:5.1f}%".format(
            f, filled, n, 100.0 * filled / n if n else 0))
    add("")

    add("--- remboursement ---")
    for label, sql in (
        ("produits rembourses CNSS",
         "SELECT COUNT(*) FROM remboursement WHERE regime='CNSS' AND remboursable=1"),
        ("produits rembourses CNOPS",
         "SELECT COUNT(*) FROM remboursement WHERE regime='CNOPS' AND remboursable=1"),
        ("base connue CNSS",
         "SELECT COUNT(*) FROM remboursement WHERE regime='CNSS' AND remboursable=1 "
         "AND base_remboursement IS NOT NULL"),
        ("base connue CNOPS",
         "SELECT COUNT(*) FROM remboursement WHERE regime='CNOPS' AND remboursable=1 "
         "AND base_remboursement IS NOT NULL"),
        ("lignes v_remboursement_officiel", "SELECT COUNT(*) FROM v_remboursement_officiel"),
        ("lignes v_remboursement (catalogue)", "SELECT COUNT(*) FROM v_remboursement"),
        ("EAN presents dans les 2 regimes", "SELECT COUNT(*) FROM v_comparatif_regimes"),
    ):
        add("  {:36s}{:7d}".format(label, con.execute(sql).fetchone()[0]))
    add("")

    add("--- rapprochement catalogue <-> listes officielles ---")
    for r in con.execute("SELECT regime, match_method, COUNT(*) FROM medicament_remboursement "
                         "GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10"):
        add("  {:6s} {:36s}{:7d}".format(r[0], r[1], r[2]))
    fiable = con.execute("SELECT COUNT(DISTINCT medicament_id) FROM medicament_remboursement "
                         "WHERE match_score >= 90").fetchone()[0]
    add("  medicaments rattaches dosage+conditionnement concordants : {}".format(fiable))
    add("")

    add("--- capacite d'equivalence ---")
    for label, sql in (
        ("cle DCI renseignee",
         "SELECT COUNT(*) FROM medicament WHERE dci_key<>''"),
        ("cle substituable renseignee",
         "SELECT COUNT(*) FROM medicament WHERE equiv_key<>''"),
        ("groupes DCI (>1 produit)",
         "SELECT COUNT(*) FROM (SELECT dci_key FROM medicament WHERE dci_key<>'' "
         "GROUP BY dci_key HAVING COUNT(*)>1)"),
        ("groupes substituables (>1 produit)",
         "SELECT COUNT(*) FROM (SELECT equiv_key FROM medicament WHERE equiv_key<>'' "
         "GROUP BY equiv_key HAVING COUNT(*)>1)"),
        ("groupes ATC niveau 4",
         "SELECT COUNT(*) FROM (SELECT atc_niveau4 FROM medicament WHERE atc_niveau4 IS NOT NULL "
         "GROUP BY atc_niveau4 HAVING COUNT(*)>1)"),
        ("groupes officiels CNOPS (>1 produit)",
         "SELECT COUNT(*) FROM (SELECT code_groupe FROM remboursement WHERE regime='CNOPS' "
         "AND code_groupe IS NOT NULL GROUP BY code_groupe HAVING COUNT(*)>1)"),
        ("paires d'equivalents officiels", "SELECT COUNT(*) FROM v_equivalents_officiels"),
    ):
        add("  {:38s}{:8d}".format(label, con.execute(sql).fetchone()[0]))
    add("")

    add("--- exemples : remboursement officiel ---")
    for r in con.execute(
            "SELECT regime, medicament, ppv, base, taux_applique, montant_rembourse, "
            "reste_a_charge FROM v_remboursement_officiel "
            "WHERE medicament LIKE 'AMOXIL%' OR medicament LIKE 'DOLIPRANE%' "
            "ORDER BY medicament, regime LIMIT 8"):
        add("  {:6s} {:30s} PPV {:>9.2f}  base {:>9.2f}  {:>3.0f}%  ->  {:>9.2f}  "
            "reste {:>8.2f}".format(r[0], str(r[1])[:30], r[2], r[3], r[4], r[5], r[6]))
    add("")

    add("--- exemples : equivalents officiels CNOPS (meme groupe) ---")
    for r in con.execute(
            "SELECT medicament, ppv, equivalent, equivalent_ppv, economie "
            "FROM v_equivalents_officiels WHERE economie > 0 AND ppv IS NOT NULL "
            "ORDER BY economie DESC LIMIT 5"):
        add("  {:30s} {:>9.2f} dh  ->  {:30s} {:>9.2f} dh   (-{:.2f})".format(
            str(r[0])[:30], r[1], str(r[2])[:30], r[3], r[4]))

    text = "\n".join(lines)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(text + "\n")
    print(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scraped", nargs="+", required=True)
    ap.add_argument("--cnss")
    ap.add_argument("--cnops")
    ap.add_argument("--schema", default="schema.sql")
    ap.add_argument("--outdir", default="out")
    ap.add_argument("--tag", default="")
    a = ap.parse_args()

    os.makedirs(a.outdir, exist_ok=True)
    schema_sql = open(a.schema, encoding="utf-8").read()

    labs, classes, subs, meds, med_subs = build_medicaments(a.scraped)
    remb = []
    if a.cnss and os.path.exists(a.cnss):
        remb += build_cnss(a.cnss)
    if a.cnops and os.path.exists(a.cnops):
        remb += build_cnops(a.cnops)
    for i, r in enumerate(remb, 1):
        r["id"] = i

    links = match_official(meds, remb)

    tag = ("_" + a.tag) if a.tag else ""
    con, sqlite_path, sql_path = persist(
        a.outdir, tag, schema_sql, labs, classes, subs, meds, med_subs, remb, links)
    rep_path = os.path.join(a.outdir, "quality_report{}.txt".format(tag))
    quality_report(con, meds, remb, links, rep_path)
    con.close()
    print("\nwrote {}\n      {}\n      {}".format(sqlite_path, sql_path, rep_path))


if __name__ == "__main__":
    main()
