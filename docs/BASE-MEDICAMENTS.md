# Base médicaments & remboursement — remplir et mettre à jour

Ce document explique **comment alimenter la base de médicaments** de MediAssist
avec le nouveau format, et comment reconstruire la base de référence nationale.

Il y a deux niveaux, à ne pas confondre :

| Niveau | Où | Contenu | Qui l'écrit |
|---|---|---|---|
| **Base de référence nationale** | schéma PostgreSQL `med_ref` | 5 030 médicaments commercialisés + les listes de remboursement CNSS et CNOPS + les groupes d'équivalence officiels | le pipeline `scripts/med-scraper` |
| **Catalogue du cabinet** | table `medicaments` (schéma `public`) | ce que le praticien prescrit réellement, avec ses favoris et ses archives | l'application, ou un import depuis la référence |

Le catalogue **pointe** vers la référence par `medicaments.ref_id`. La référence
n'est jamais modifiée par l'application.

---

## 1. Le nouveau format d'un médicament

La migration `2026_08_31_000001_add_reference_link_and_dosage_preference`
ajoute deux colonnes à `medicaments` :

| Colonne | Rôle |
|---|---|
| `ref_id` | identifiant dans `med_ref.medicament`. `NULL` pour un produit saisi à la main qui n'existe pas dans la base nationale. |
| `brand` | **nom de marque sans le dosage** : `AMOXIL` pour `AMOXIL 1 G`. C'est ce qui permet d'afficher la marque et le dosage dans deux colonnes distinctes. |

Champs déjà présents et désormais tous renseignés par l'import :
`name`, `dosage`, `composition` (DCI séparées par `|`), `price` (PPV),
`prix_hospitalier`, `Classe_thérapeutique`, `Code_ATCv` (code ATC),
`laboratory`, `type` (forme galénique), `statut`.

### Préférences d'affichage

Deux réglages dans **Réglages → Affichage** (colonnes `user_settings`) :

- `separate_dosage` — affiche « Marque » et « Dosage » dans deux colonnes au
  lieu de `AMOXIL 1 G` sur une seule ligne.
- `show_reimbursement` — affiche la colonne de prise en charge CNSS / CNOPS.

> Toute nouvelle colonne de `user_settings` doit être ajoutée au tableau
> `$allowed` de `SettingsController@updateUserSettings`, sinon elle est
> silencieusement ignorée à l'enregistrement.

---

## 2. Reconstruire la base de référence nationale

Prérequis : Docker.

```bash
cd scripts/med-scraper
docker build -t medscraper .
./run_all.sh              # rafraîchit tout (le scrape reprend où il s'est arrêté)
./run_all.sh --fresh      # re-scrape intégralement
```

Ce que fait `run_all.sh`, dans l'ordre :

1. `enumerate_listing.py` — énumère le catalogue vivant de medicament.ma via le
   listing alphabétique (`?lettre=X&paged=N`). **Ne pas utiliser le sitemap** :
   la moitié de ses URL sont mortes (vérifié : 120/120 renvoient 404).
2. `scrape_medicaments.py` — une requête par fiche produit, reprise possible.
3. `fetch_cnss.py` — liste officielle CNSS (page Next.js paginée,
   `?page=N&limit=2000`), avec le **taux de remboursement publié par produit**.
4. `fetch_cnops.py` — liste officielle CNOPS (endpoint JSON `/cnops/medicaments/`),
   avec les **groupes de substitution officiels** (`CODE_GROUPE`).
5. `build_db.py` — normalise, rapproche les trois sources et produit :
   - `out/medicaments_ma.sqlite` — base interrogeable immédiatement
   - `out/medicaments_ma.sql` — schéma + données, **valide sur SQLite et PostgreSQL**
   - `out/quality_report.txt` — couverture des champs et qualité des rapprochements

Durée typique : 20–40 min selon le débit (≈ 5 000 pages produit).

### Charger la référence dans PostgreSQL

```bash
cd scripts/med-scraper
./load_postgres.sh out/medicaments_ma.sql med_ref mediassist_db
```

Le script recrée le schéma `med_ref` et y charge tout. **La table `medicaments`
de l'application n'est jamais touchée.** À la fin il affiche un récapitulatif :

```
 medicament       |  5030
 remboursement    | 17894
 substance        |  1471
 rembourses CNSS  |  5261
 rembourses CNOPS |  5196
```

---

## 3. Remplir le catalogue du cabinet

### a) Import en masse depuis la référence

```bash
# 500 produits par appel (limite de l'endpoint)
for OFF in $(seq 0 500 5000); do
  IDS=$(docker exec mediassist_db psql -U postgres -d mediassist -t -A -c \
    "SELECT string_agg(id::text,',') FROM (SELECT id FROM med_ref.medicament ORDER BY id LIMIT 500 OFFSET $OFF) t")
  [ -z "$IDS" ] && break
  curl -s -X POST -H "Content-Type: application/json" \
       -d "{\"ref_ids\":[$IDS]}" http://localhost:8000/api/medicaments/reference/import
done
```

L'import est **idempotent** : un produit déjà lié par `ref_id` est mis à jour
(prix rafraîchis), pas dupliqué.

### b) Import sélectif

```bash
# chercher, puis importer les ref_id retenus
curl "http://localhost:8000/api/medicaments/reference/search?q=amoxil"
curl -X POST -H "Content-Type: application/json" \
     -d '{"ref_ids":[107,108,116]}' \
     http://localhost:8000/api/medicaments/reference/import
```

> Choix produit : l'import en masse rend la page immédiatement utilisable, mais
> un catalogue de cabinet est normalement **curé**. Pour une livraison client,
> préférer l'import sélectif.

---

## 4. Les endpoints de remboursement et d'équivalence

Tous dégradent proprement si le schéma `med_ref` est absent : ils répondent
`available: false` avec des tableaux vides, et l'interface masque les sections.

| Endpoint | Réponse |
|---|---|
| `GET /api/medicaments/reference/search?q=` | fiches de la base nationale |
| `GET /api/medicaments/reference/coverage?ids=1,2,3` | prise en charge d'une page entière, **une requête pour toute la liste** |
| `POST /api/medicaments/reference/import` | `{ ref_ids: [] }` |
| `GET /api/medicaments/{id}/remboursement` | base, taux, montant remboursé, reste à charge, et les mêmes chiffres en ALD, pour CNSS et CNOPS |
| `GET /api/medicaments/{id}/equivalents` | `officiels` (groupe CNOPS), `substituables` (même DCI + dosage + forme), `meme_dci` |

**Règle de sécurité :** `v_remboursement` et l'endpoint `remboursement`
n'exposent que les rapprochements de score **≥ 90** (nom + dosage +
conditionnement concordants). Une correspondance sur le seul nom ne doit jamais
produire un chiffre de remboursement : la même marque existe en boîte de 10 et
de 30, en flacon de 10 ml et de 20 ml, avec une base différente à chaque fois.

---

## 5. Vérifier après un chargement

```bash
docker exec -it mediassist_db psql -U postgres -d mediassist
```

```sql
SET search_path TO med_ref;

-- Reste à charge sur un produit
SELECT regime, presentation, ppv, base, taux_applique,
       montant_rembourse, reste_a_charge, montant_rembourse_ald
FROM v_remboursement_officiel
WHERE medicament = 'AMOXIL' AND dosage LIKE '1 G%';

-- Générique officiel moins cher
SELECT medicament, ppv, equivalent, equivalent_ppv, economie_pct
FROM v_equivalents_officiels
WHERE medicament = 'VIAGRA' AND economie_pct > 0
ORDER BY economie_pct DESC;
```

Et côté application :

```bash
curl "http://localhost:8000/api/medicaments/1/remboursement"
curl "http://localhost:8000/api/medicaments/1/equivalents"
```

---

## 6. Pièges rencontrés (à ne pas réintroduire)

- **`apiClient.request()` enveloppe toujours la réponse** dans
  `{ success, data: <corps> }`. Lire `r.coverage` au premier niveau renvoie
  `undefined` : il faut déballer `r.data`. C'est ce qui affichait « Non listé »
  sur toutes les lignes alors que l'API répondait correctement.
- **Le nombre d'unités dépend de la forme galénique.** « Flacon de 60 » vaut
  60 gélules pour un solide, mais un flacon de 60 ml pour un liquide.
  `pres_signature()` prend donc la forme en paramètre, et `ppv_unitaire` n'est
  calculé que pour les conditionnements réellement dénombrables.
- **`MAX(a, b)` n'existe pas en PostgreSQL** (c'est du SQLite). Utiliser
  `CASE WHEN … END` pour garder le SQL portable.
- **Carbon 3 renvoie une différence signée.** `$fin->diffInMinutes($debut)`
  vaut `-25`, pas `25` — un test `> 0` rejette alors toutes les lignes. C'est ce
  qui bloquait le « temps moyen de consultation » à 0.
