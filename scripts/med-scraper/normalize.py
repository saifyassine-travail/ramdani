#!/usr/bin/env python3
"""Shared text/dose normalisation helpers for the medicament pipeline."""
import re, unicodedata

UNIT_ALIASES = {
    "MCG": "UG", "µG": "UG", "ΜG": "UG", "UG": "UG", "MICROGRAMME": "UG", "MICROGRAMMES": "UG",
    "MG": "MG", "MILLIGRAMME": "MG", "MILLIGRAMMES": "MG",
    "G": "G", "GR": "G", "GRAMME": "G", "GRAMMES": "G",
    "KG": "KG", "ML": "ML", "L": "L", "UI": "UI", "U": "UI", "MEQ": "MEQ",
    "MMOL": "MMOL", "%": "%", "MUI": "MUI",
}
# to milligram-equivalents where a conversion is meaningful
TO_MG = {"UG": 0.001, "MG": 1.0, "G": 1000.0, "KG": 1_000_000.0}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(s) -> str:
    """Uppercase, accent-free, punctuation-collapsed key for joins/dedup."""
    if not s:
        return ""
    s = strip_accents(str(s)).upper()
    s = s.replace("’", "'").replace("`", "'")
    s = re.sub(r"[^\w%'./+-]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def norm_name(s) -> str:
    """Normalised commercial/DCI name: no dosage tail, no punctuation noise."""
    s = norm(s)
    s = re.sub(r"\b(\d+([.,]\d+)?)\s*(MG|G|UG|ML|UI|%|MCG|µG)\b", " ", s)
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


NUM_UNIT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(%|[A-Zµ]+)?")


def parse_doses(raw):
    """'500 MG | 0.02 G' -> [(500.0,'MG'), (0.02,'G')] (order preserved)."""
    out = []
    if not raw:
        return out
    for chunk in re.split(r"[|/+]", str(raw)):
        c = norm(chunk)
        for m in NUM_UNIT_RE.finditer(c):
            val = float(m.group(1).replace(",", "."))
            unit = UNIT_ALIASES.get((m.group(2) or "").upper(), (m.group(2) or "").upper())
            out.append((val, unit))
            break            # one dose per chunk
    return out


def dose_key(raw) -> str:
    """Canonical, comparable dose signature ('0.02G' and '20MG' both -> 20MG)."""
    parts = []
    for val, unit in parse_doses(raw):
        if unit in TO_MG:
            parts.append(f"{round(val * TO_MG[unit], 6):g}MG")
        elif unit:
            parts.append(f"{val:g}{unit}")
        else:
            parts.append(f"{val:g}")
    return "+".join(parts)


FORM_CANON = [
    (r"COMPRIME|CPR|CP\b", "COMPRIME"),
    (r"GELULE|CAPSULE", "GELULE"),
    (r"SACHET", "POUDRE/SACHET"),
    (r"SIROP", "SIROP"),
    (r"SUSPENSION BUVABLE|SUSPENSION", "SUSPENSION"),
    (r"SOLUTION BUVABLE", "SOLUTION BUVABLE"),
    (r"SOLUTION INJECTABLE|INJECTABLE|PERFUSION|AMPOULE", "INJECTABLE"),
    (r"POMMADE", "POMMADE"),
    (r"CREME", "CREME"),
    (r"GEL\b", "GEL"),
    (r"COLLYRE", "COLLYRE"),
    (r"SUPPOSITOIRE", "SUPPOSITOIRE"),
    (r"OVULE", "OVULE"),
    (r"POUDRE", "POUDRE/SACHET"),
    (r"PATCH|DISPOSITIF TRANSDERMIQUE", "PATCH"),
    (r"SPRAY|PULVERISATION|AEROSOL|INHALATION", "INHALATION/SPRAY"),
    (r"GOUTTE", "GOUTTES"),
    (r"SIROP|SOLUTION", "SOLUTION"),
]


def form_key(raw) -> str:
    """Group galenic forms so 'Comprimé pelliculé sécable' == 'Comprimé'."""
    s = norm(raw)
    for pat, canon in FORM_CANON:
        if re.search(pat, s):
            return canon
    return s or "AUTRE"


def money(v):
    """'1 356,00 dhs' -> 1356.0"""
    if v is None:
        return None
    s = str(v).replace(" ", " ").replace(" ", "")
    s = s.lower().replace("dhs", "").replace("dh", "").replace(",", ".")
    s = re.sub(r"[^0-9.]", "", s)
    if s.count(".") > 1:
        head, _, tail = s.rpartition(".")
        s = head.replace(".", "") + "." + tail
    try:
        return round(float(s), 2)
    except ValueError:
        return None


MONTHS_FR = {m: i for i, m in enumerate(
    ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
     "août", "septembre", "octobre", "novembre", "décembre"], 1)}


def parse_fr_date(s):
    """'2 février 2024' -> '2024-02-02'"""
    if not s:
        return None
    m = re.match(r"\s*(\d{1,2})\s+([^\s]+)\s+(\d{4})", str(s).strip())
    if not m:
        return None
    mon = MONTHS_FR.get(m.group(2).lower())
    if not mon:
        return None
    return f"{int(m.group(3)):04d}-{mon:02d}-{int(m.group(1)):02d}"


VOLUME_UNITS = {"ML", "L", "G", "MG", "UG", "KG", "UI", "%", "MUI", "MEQ", "MMOL", "CC"}
# Nouns that can actually be counted in a pack.
COUNTABLE = {"COMPRIME", "COMPRIMES", "CPR", "GELULE", "GELULES", "CAPSULE", "CAPSULES",
             "SACHET", "SACHETS", "AMPOULE", "AMPOULES", "SUPPOSITOIRE", "SUPPOSITOIRES",
             "OVULE", "OVULES", "SERINGUE", "SERINGUES", "STYLO", "STYLOS", "PATCH",
             "PATCHS", "DOSE", "DOSES", "UNIDOSE", "UNIDOSES", "PIPETTE", "PIPETTES",
             "FLACON", "FLACONS", "TUBE", "TUBES", "POCHE", "POCHES", "BIDON", "BIDONS",
             "POT", "POTS", "CARTOUCHE", "CARTOUCHES"}
# Containers whose trailing number is a *size*, not a quantity: "Flacon de 500"
# is one 500 ml bottle, not five hundred bottles.
SIZED_CONTAINERS = {"FLACON", "FLACONS", "BIDON", "BIDONS", "TUBE", "TUBES", "POCHE",
                    "POCHES", "POT", "POTS", "PULVERISATEUR", "SPRAY", "AEROSOL",
                    "CARTOUCHE", "CARTOUCHES", "SERINGUE", "SERINGUES"}
# Wrappers whose trailing number really is a quantity: "Boite de 30".
COUNTING_WRAPPERS = {"BOITE", "BOITES", "BLISTER", "BLISTERS", "PLAQUETTE", "PLAQUETTES",
                     "ETUI", "ETUIS", "PLAQUE", "PLAQUES"}

_DECIMAL_COMMA_RE = re.compile(r"(\d),(\d)")
_TOKEN_RE = re.compile(r"\d+(?:\.\d+)?|[A-Z%]+")

# Forms made of discrete units. For those, "Flacon de 60" means sixty gelules
# in one bottle; for a liquid the same wording means a 60 ml bottle. The
# galenic form is the only thing that tells the two apart.
SOLID_FORMS = {"COMPRIME", "GELULE", "SUPPOSITOIRE", "OVULE", "POUDRE/SACHET", "PATCH"}
# Units that can carry a meaningful per-unit price.
COUNTED_UNITS = {"COMPRIME", "GELULE", "SACHET", "AMPOULE", "SUPPOSITOIRE",
                 "OVULE", "PATCH", "SERINGUE"}


def pres_signature(raw, form=None):
    """
    Reduce a presentation label to (pack_count, volume_ml).

    'Boite de 30'                  -> (30, None)
    '1 BOITE 30 COMPRIME'          -> (30, None)
    'Boite de 5 ampoules de 2 ml'  -> (5, 2.0)
    'Flacon de 60 ml'              -> (1, 60.0)
    'Flacon de 60'   + gelule      -> (60, None)   # sixty capsules in a bottle
    'Flacon de 500'  + solution    -> (1, None)    # a 500 ml bottle
    'Flacon de 37,5 ml'            -> (1, 37.5)
    """
    if not raw:
        return (None, None)
    txt = _DECIMAL_COMMA_RE.sub(r"\1.\2", str(raw))
    s = norm(txt)
    if not s:
        return (None, None)

    solid = form_key(form) in SOLID_FORMS if form else False
    tokens = _TOKEN_RE.findall(s)
    counts, vol, saw_container = [], None, False
    last_noun = None
    for i, tok in enumerate(tokens):
        if not tok[0].isdigit():
            if tok not in ("DE", "D", "EN", "A", "UN", "UNE"):
                last_noun = tok
            if tok in SIZED_CONTAINERS or tok in COUNTING_WRAPPERS:
                saw_container = True
            continue
        val = float(tok)
        nxt = tokens[i + 1] if i + 1 < len(tokens) else None
        unit = UNIT_ALIASES.get(nxt, nxt) if nxt else None

        if unit in VOLUME_UNITS:
            if unit in ("ML", "CC") and vol is None:
                vol = val
            elif unit == "L" and vol is None:
                vol = val * 1000.0
            continue
        if nxt in COUNTABLE:
            counts.append(val)
            continue
        if last_noun in COUNTING_WRAPPERS or last_noun is None:
            counts.append(val)
        elif last_noun in SIZED_CONTAINERS and solid:
            counts.append(val)          # discrete units inside the container
    if counts:
        pack = int(max(counts))
    elif vol is not None or saw_container:
        pack = 1
    else:
        pack = None
    return (pack, vol)


# Container actually counted by `pack_size`. Two products are only comparable
# on a per-unit basis when they are counted in the same thing: 14 sachets and
# one 100 ml bottle both give pack_size, but "price per unit" means something
# completely different in each case.
_UNIT_KINDS = [
    (r"COMPRIME|COMPRIMES|CPR", "COMPRIME"),
    (r"GELULE|CAPSULE", "GELULE"),
    (r"SACHET", "SACHET"),
    (r"AMPOULE", "AMPOULE"),
    (r"SUPPOSITOIRE", "SUPPOSITOIRE"),
    (r"OVULE", "OVULE"),
    (r"SERINGUE|STYLO", "SERINGUE"),
    (r"PATCH|DISPOSITIF", "PATCH"),
    (r"FLACON|BIDON|POCHE|TUBE|POT|PULVERISATEUR", "FLACON"),
]


def unit_kind(presentation, form=None):
    """What `pack_size` counts, e.g. 'Boite de 14 sachets' -> SACHET."""
    s = norm(presentation) + " " + norm(form or "")
    for pat, kind in _UNIT_KINDS:
        if re.search(pat, s):
            return kind
    return None
