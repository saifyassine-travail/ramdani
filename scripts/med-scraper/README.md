# Base médicaments Maroc — catalogue + remboursement AMO (CNSS / CNOPS)

Base SQL des médicaments commercialisés au Maroc, avec pour chacun son statut
de remboursement, sa **base de remboursement**, le **taux appliqué**, le
**montant remboursé** et le **reste à charge** — côté CNSS *et* côté CNOPS —
plus de quoi faire de l'**équivalence entre médicaments** (générique
substituable officiel, même DCI, même classe ATC).

## Sources

Le remboursement vient **exclusivement des deux organismes gestionnaires de
l'AMO**, pas d'un intermédiaire :

| Source | Ce qu'elle apporte | Accès |
|---|---|---|
| **CNSS** — [liste des médicaments](https://www.cnss.ma/fr/listes-des-medicaments) | EAN-13, laboratoire, nom, DCI, dosage, forme, présentation, PPV, PH, **PPV-BR** (base de remboursement), classe thérapeutique, **Taux Rembours** (le taux réellement appliqué, par produit) | page Next.js paginée, `?page=N&limit=2000` |
| **CNOPS** — [médicaments remboursables](https://www.cnops.org.ma/fr/medicaments) | EAN-13, libellé, DCI, dosage, forme, présentation, REMBOURSABLE, PRIX_PPV, **PRIX_PBR**, princeps/générique, **CODE_GROUPE** (groupe de substitution officiel), CODE_PRINCEPS | endpoint JSON `/cnops/medicaments/` appelé par la page elle-même |
| [medicament.ma](https://medicament.ma) | le catalogue commercial : forme galénique détaillée, composition, code ATC, classe thérapeutique, laboratoire, tableau, indications, prix courants | HTML public ; `robots.txt` n'interdit que `/wp-admin/` |

Les deux listes officielles se recoupent sur le code-barres : **7 661 EAN-13
communs**, et la base de remboursement y est identique dans 5 164 cas sur
5 189 comparables.

Les taux (70 % ambulatoire, 100 % ALD/ALC) sont ceux publiés par la CNOPS
(décret 2.05-736) et par la CNSS, stockés dans `regime` avec l'URL source.
La CNSS publiant un taux **par produit**, c'est lui qui est utilisé quand il
existe.

### Pourquoi pas le sitemap medicament.ma

`wp-sitemap-posts-medicament-*.xml` liste 10 999 URL mais **~50 % renvoient
404** (anciens slugs). L'énumération passe donc par le listing alphabétique du
site (`/listing-des-medicaments/?lettre=X&paged=N`), qui reflète le catalogue
vivant : **5 030 produits**.

## Pipeline

```
enumerate_listing.py   A→Z, 20 produits/page   ->  data/listing_all.jsonl
scrape_medicaments.py  1 requête par fiche     ->  data/medicaments.jsonl
fetch_cnss.py          5 pages de 2000 lignes  ->  data/cnss_medicaments.jsonl
fetch_cnops.py         1 appel JSON            ->  data/cnops_medicaments.jsonl
build_db.py            normalisation + jointure->  out/medicaments_ma.{sqlite,sql}
                                                   out/quality_report.txt
```

Tout tourne dans une image Docker (`Dockerfile`). Un seul point d'entrée :

```bash
./run_all.sh            # rafraîchit tout (le scrape reprend où il s'est arrêté)
./run_all.sh --fresh    # re-scrape intégralement
```

Chargement dans le PostgreSQL de MediAssist, dans son propre schéma (la table
`medicaments` de l'application n'est pas touchée) :

```bash
./load_postgres.sh out/medicaments_ma.sql med_ref mediassist_db
```

## Schéma

`schema.sql` est valide tel quel sur **SQLite et PostgreSQL** (vérifié sur les
deux).

| Table | Contenu |
|---|---|
| `medicament` | une ligne par présentation commercialisée (clé = id medicament.ma) |
| `substance`, `medicament_substance` | composition détaillée, DCI + dosage par substance |
| `laboratory`, `therapeutic_class` | dimensions |
| `remboursement` | une ligne par (régime, EAN-13) — la table de référence du remboursement |
| `medicament_remboursement` | rapprochement catalogue ⇄ listes officielles, avec score et méthode |
| `regime` | CNSS / CNOPS : taux ambulatoire, taux ALD, assiette, URL source |

### Clés d'équivalence portées par `medicament`

| Colonne | Contenu | Usage |
|---|---|---|
| `dci_key` | DCI normalisées, triées, jointes par `+` | même principe actif |
| `dose_key` | dosages convertis en mg (`0.02 G` → `20MG`) | comparaison de dosage fiable |
| `form_key` | forme canonique (`Comprimé pelliculé sécable` → `COMPRIME`) | comparaison de forme |
| `equiv_key` | `dci_key \| dose_key \| form_key` | **substituable** |
| `atc_niveau4` | 5 premiers caractères du code ATC | alternative thérapeutique |
| `unite_conditionnement` | ce que compte `pack_size` (COMPRIME, SACHET, FLACON…) | garde-fou de comparaison |
| `ppv_unitaire` | PPV / nombre d'unités, **uniquement pour les formes dénombrables** | comparer une boîte de 10 et une de 30 |

## Vues prêtes à l'emploi

| Vue | Réponse |
|---|---|
| `v_medicament` | fiche à plat, lisible |
| `v_remboursement_officiel` | **par code-barres** : base, taux, montant remboursé, reste à charge, et le même calcul en ALD |
| `v_remboursement` | idem, rattaché à une fiche du catalogue |
| `v_comparatif_regimes` | CNSS et CNOPS côte à côte pour un même EAN |
| `v_equivalents_officiels` | **groupe de substitution officiel CNOPS** — la référence opposable |
| `v_equivalents_generique` | même DCI + dosage + forme, économie en % à l'unité |
| `v_alternative_moins_chere` | le substituable le moins cher pour chaque médicament |
| `v_equivalents_dci` | même(s) principe(s) actif(s) |
| `v_equivalents_atc` | alternatives de même classe ATC niveau 4 |

### Exemples

```sql
-- Combien reste-t-il à charge sur AMOXIL 1 G ?
SELECT regime, presentation, ppv, base, taux_applique,
       montant_rembourse, reste_a_charge, montant_rembourse_ald
FROM v_remboursement_officiel
WHERE medicament = 'AMOXIL' AND dosage LIKE '1 G%';

-- Générique officiel moins cher (groupe CNOPS)
SELECT medicament, ppv, equivalent, equivalent_ppv, economie_pct
FROM v_equivalents_officiels
WHERE medicament = 'VIAGRA' AND economie_pct > 0
ORDER BY economie_pct DESC;

-- Le moins cher à l'unité, à conditionnement comparable
SELECT medicament, ppv_unitaire, alternative, alternative_ppv_unitaire, economie_pct
FROM v_alternative_moins_chere ORDER BY economie_pct DESC LIMIT 20;
```

## Choix de rapprochement catalogue ⇄ listes officielles

Le nom commercial sert d'ancre ; un candidat n'est retenu à pleine confiance
que si le **dosage** et le **conditionnement** concordent aussi. La même marque
est listée plusieurs fois par organisme (boîte de 10 vs 30, flacon de 10 ml vs
20 ml) avec une base différente à chaque fois : rattacher la mauvaise ligne
produirait un remboursement faux. Un écart de volume est activement pénalisé,
et **`v_remboursement` n'expose que les rapprochements de score ≥ 90**
(nom + dosage + conditionnement) — l'argent ne repose jamais sur une
correspondance de nom seule.

Le nombre d'unités d'une présentation dépend de la forme : « Flacon de 60 »
vaut 60 gélules pour un solide mais un flacon de 60 ml pour un liquide.
`pres_signature()` prend donc la forme galénique en compte, et `ppv_unitaire`
n'est calculé que lorsque le conditionnement compte des unités réellement
dénombrables.

## Limites connues

- `posologie`, `contre_indications`, `grossesse`… ne sont renseignés que sur une
  minorité de fiches : medicament.ma ne les publie pas partout (0,5 % pour la
  posologie).
- 73 % des fiches du catalogue sont rattachées à au moins une liste officielle ;
  le reste correspond largement à des produits non remboursables (compléments
  alimentaires, dispositifs) ou absents des listes.
- Les taux sont ceux de droit commun ; un dossier ALD, une entente préalable ou
  une convention peuvent donner un taux différent. La couverture mutualiste
  complémentaire CNOPS (16 à 20 % supplémentaires) n'est pas modélisée.

## Base pré-construite (`dist/`)

`dist/medicaments_ma.sql.gz` est la base déjà construite, versionnée pour ne pas
avoir à relancer un scrape de 40 minutes pour une simple installation. C'est le
chemin à suivre pour installer MediAssist sur un nouveau poste.

```bash
./load_postgres.sh dist/medicaments_ma.sql.gz med_ref mediassist_db
```

Le script lit le `.gz` directement — pas de décompression préalable, donc rien
à créer à la main. (Une version antérieure de ce README demandait de faire
`gunzip -c ... > out/...` : `out/` étant gitignoré, il est absent d'un clone
neuf et la commande échouait avec « No such file or directory ».)

Récapitulatif attendu en fin de chargement :

```
 medicament       |  5030
 remboursement    | 17894
 substance        |  1471
 rembourses CNSS  |  5261
 rembourses CNOPS |  5196
```

`dist/quality_report.txt` donne la couverture des champs et la qualité des
rapprochements du relevé correspondant.

Les données brutes du scrape (`data/*.jsonl`) ne sont pas versionnées : elles
pèsent ~14 Mo et `./run_all.sh` les régénère intégralement.
