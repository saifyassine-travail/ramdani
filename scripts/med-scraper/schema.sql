-- ============================================================================
--  Base medicaments Maroc
--    catalogue      : medicament.ma
--    remboursement  : CNSS (www.cnss.ma) et CNOPS (www.cnops.org.ma), sources
--                     officielles des deux organismes gestionnaires de l'AMO
--  SQL portable : valide tel quel sur SQLite et PostgreSQL.
-- ============================================================================

DROP VIEW  IF EXISTS v_comparatif_regimes;
DROP VIEW  IF EXISTS v_equivalents_atc;
DROP VIEW  IF EXISTS v_equivalents_officiels;
DROP VIEW  IF EXISTS v_alternative_moins_chere;
DROP VIEW  IF EXISTS v_equivalents_generique;
DROP VIEW  IF EXISTS v_equivalents_dci;
DROP VIEW  IF EXISTS v_remboursement;
DROP VIEW  IF EXISTS v_remboursement_officiel;
DROP VIEW  IF EXISTS v_medicament;
DROP TABLE IF EXISTS medicament_remboursement;
DROP TABLE IF EXISTS medicament_substance;
DROP TABLE IF EXISTS remboursement;
DROP TABLE IF EXISTS medicament;
DROP TABLE IF EXISTS substance;
DROP TABLE IF EXISTS therapeutic_class;
DROP TABLE IF EXISTS laboratory;
DROP TABLE IF EXISTS regime;

-- ── Regimes AMO ────────────────────────────────────────────────────────────
CREATE TABLE regime (
    code              VARCHAR(8)   PRIMARY KEY,
    name              VARCHAR(160) NOT NULL,
    population        VARCHAR(160),
    taux_ambulatoire  NUMERIC(5,2) NOT NULL,  -- % de la base, hors ALD
    taux_ald          NUMERIC(5,2) NOT NULL,  -- % de la base, ALD/ALC avec ETM
    base              VARCHAR(80)  NOT NULL,  -- assiette du remboursement
    source_url        TEXT,
    note              TEXT
);

-- ── Dimensions ─────────────────────────────────────────────────────────────
CREATE TABLE laboratory (
    id        INTEGER PRIMARY KEY,
    name      VARCHAR(255) NOT NULL,
    name_norm VARCHAR(255) NOT NULL UNIQUE,
    url       TEXT
);

CREATE TABLE therapeutic_class (
    id        INTEGER PRIMARY KEY,
    name      VARCHAR(1000) NOT NULL,
    name_norm VARCHAR(1000) NOT NULL UNIQUE
);

CREATE TABLE substance (
    id        INTEGER PRIMARY KEY,
    name      VARCHAR(1000) NOT NULL,
    name_norm VARCHAR(1000) NOT NULL UNIQUE
);

-- ── Catalogue : une ligne = une presentation commercialisee ────────────────
CREATE TABLE medicament (
    id                    INTEGER PRIMARY KEY,       -- id medicament.ma
    slug                  VARCHAR(255) NOT NULL UNIQUE,
    url                   TEXT NOT NULL,
    name                  VARCHAR(400) NOT NULL,     -- libelle complet affiche
    brand                 VARCHAR(255) NOT NULL,     -- nom commercial sans dosage
    form                  VARCHAR(255),              -- forme galenique
    form_key              VARCHAR(64),               -- forme canonique (equivalence)
    dosage                VARCHAR(255),
    dose_key              VARCHAR(255),              -- dosage canonique en mg (equivalence)
    presentation          VARCHAR(255),
    pack_size             INTEGER,                   -- nombre d'unites par boite
    pres_vol_ml           NUMERIC(12,3),             -- volume du contenant, en ml
    unite_conditionnement VARCHAR(16),               -- ce que compte pack_size
    ppv_unitaire          NUMERIC(12,4),             -- PPV rapporte a une unite
    laboratory_id         INTEGER REFERENCES laboratory(id),
    therapeutic_class_id  INTEGER REFERENCES therapeutic_class(id),
    atc_code              VARCHAR(16),
    atc_niveau1           VARCHAR(1),
    atc_niveau3           VARCHAR(4),
    atc_niveau4           VARCHAR(5),
    composition           TEXT,                      -- brut, separe par « | »
    dci_key               VARCHAR(500),              -- DCI normalisees triees
    equiv_key             VARCHAR(700),              -- dci_key + dosage + forme
    statut                VARCHAR(64),
    tableau               VARCHAR(16),               -- substances veneneuses
    nature                VARCHAR(64),               -- Medicament / Dispositif / Complement
    is_princeps           SMALLINT NOT NULL DEFAULT 0,
    is_generique          SMALLINT NOT NULL DEFAULT 0,
    ppv                   NUMERIC(10,2),
    prix_hospitalier      NUMERIC(10,2),
    ppc                   NUMERIC(10,2),             -- prix public conseille
    indications           TEXT,
    contre_indications    TEXT,
    posologie             TEXT,
    mises_en_garde        TEXT,
    effets_indesirables   TEXT,
    grossesse             TEXT,
    allaitement           TEXT,
    conservation          TEXT,
    notice_url            TEXT,
    date_maj              DATE,
    date_ajout            DATE,
    scraped_at            TIMESTAMP
);

CREATE INDEX idx_med_brand     ON medicament(brand);
CREATE INDEX idx_med_dci_key   ON medicament(dci_key);
CREATE INDEX idx_med_equiv_key ON medicament(equiv_key);
CREATE INDEX idx_med_atc       ON medicament(atc_code);
CREATE INDEX idx_med_lab       ON medicament(laboratory_id);
CREATE INDEX idx_med_class     ON medicament(therapeutic_class_id);

CREATE TABLE medicament_substance (
    medicament_id INTEGER NOT NULL REFERENCES medicament(id),
    substance_id  INTEGER NOT NULL REFERENCES substance(id),
    position      INTEGER NOT NULL,
    dosage        VARCHAR(255),
    dose_value    NUMERIC(20,6),
    dose_unit     VARCHAR(16),
    PRIMARY KEY (medicament_id, substance_id, position)
);
CREATE INDEX idx_ms_substance ON medicament_substance(substance_id);

-- ── Remboursement : donnees publiees par la CNSS et la CNOPS ───────────────
-- Une ligne par (regime, code EAN-13). C'est la table de reference pour
-- repondre a « ce medicament est-il rembourse, sur quelle base, a quel taux ».
CREATE TABLE remboursement (
    id                    INTEGER PRIMARY KEY,
    regime                VARCHAR(8)  NOT NULL REFERENCES regime(code),
    ean13                 VARCHAR(13) NOT NULL,
    nom                   VARCHAR(255) NOT NULL,
    nom_norm              VARCHAR(255),
    dci                   VARCHAR(400),
    dci_norm              VARCHAR(400),
    laboratoire           VARCHAR(255),
    forme                 VARCHAR(255),
    dosage                VARCHAR(64),
    unite_dosage          VARCHAR(32),
    dose_key              VARCHAR(255),
    presentation          VARCHAR(255),
    pack_size             INTEGER,
    pres_vol_ml           NUMERIC(12,3),
    unite_conditionnement VARCHAR(16),
    classe_therapeutique  VARCHAR(255),
    ppv                   NUMERIC(10,2),
    prix_hospitalier      NUMERIC(10,2),
    base_remboursement    NUMERIC(10,2),   -- assiette: PPV-BR (CNSS) / PRIX_PBR (CNOPS)
    taux                  NUMERIC(5,2),    -- % applique (la CNSS le publie par produit)
    remboursable          SMALLINT NOT NULL,
    categorie             VARCHAR(4),      -- P/G cote CNOPS, A/B/C/N cote CNSS
    code_groupe           VARCHAR(16),     -- CNOPS : groupe de substitution officiel
    code_princeps         VARCHAR(13)      -- CNOPS : EAN du princeps du groupe
);
CREATE UNIQUE INDEX idx_remb_regime_ean ON remboursement(regime, ean13);
CREATE INDEX idx_remb_ean    ON remboursement(ean13);
CREATE INDEX idx_remb_nom    ON remboursement(nom_norm);
CREATE INDEX idx_remb_dci    ON remboursement(dci_norm);
CREATE INDEX idx_remb_groupe ON remboursement(code_groupe);

-- ── Rapprochement catalogue ⇄ listes officielles ───────────────────────────
CREATE TABLE medicament_remboursement (
    medicament_id INTEGER NOT NULL REFERENCES medicament(id),
    regime        VARCHAR(8)  NOT NULL REFERENCES regime(code),
    ean13         VARCHAR(13) NOT NULL,
    match_score   NUMERIC(5,2) NOT NULL,   -- 0..100
    match_method  VARCHAR(60)  NOT NULL,
    PRIMARY KEY (medicament_id, regime)
);
CREATE INDEX idx_mr_ean ON medicament_remboursement(ean13);

-- ============================================================================
--  Vues de lecture
-- ============================================================================

-- Fiche medicament a plat.
CREATE VIEW v_medicament AS
SELECT  m.id,
        m.name                              AS medicament,
        m.brand                             AS nom_commercial,
        m.form                              AS forme,
        m.dosage,
        m.presentation,
        m.pack_size                         AS conditionnement,
        l.name                              AS laboratoire,
        tc.name                             AS classe_therapeutique,
        m.atc_code,
        m.composition,
        m.statut,
        m.tableau,
        m.nature,
        CASE WHEN m.is_princeps = 1 THEN 'Princeps'
             WHEN m.is_generique = 1 THEN 'Generique' END AS type,
        m.ppv,
        m.ppv_unitaire,
        m.prix_hospitalier,
        m.dci_key, m.equiv_key,
        m.date_maj, m.url
FROM medicament m
LEFT JOIN laboratory        l  ON l.id  = m.laboratory_id
LEFT JOIN therapeutic_class tc ON tc.id = m.therapeutic_class_id;

-- Remboursement tel que publie par chaque organisme, adressable par code-barres
-- sans passer par le catalogue.  `taux` vient du produit quand l'organisme le
-- publie (CNSS), sinon du taux ambulatoire du regime (CNOPS).
CREATE VIEW v_remboursement_officiel AS
SELECT  r.regime,
        r.ean13,
        r.nom                       AS medicament,
        r.dci,
        r.laboratoire,
        r.forme,
        r.dosage || ' ' || COALESCE(r.unite_dosage, '') AS dosage,
        r.presentation,
        r.classe_therapeutique,
        r.categorie,
        CASE r.remboursable WHEN 1 THEN 'Oui' ELSE 'Non' END AS remboursable,
        r.ppv,
        r.base_remboursement        AS base,
        COALESCE(r.taux, g.taux_ambulatoire) AS taux_applique,
        ROUND(r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2)
                                    AS montant_rembourse,
        CASE WHEN ROUND(r.ppv - r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2) < 0 THEN 0 ELSE ROUND(r.ppv - r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2) END
                                    AS reste_a_charge,
        ROUND(r.base_remboursement * g.taux_ald / 100.0, 2)  AS montant_rembourse_ald,
        CASE WHEN ROUND(r.ppv - r.base_remboursement * g.taux_ald / 100.0, 2) < 0 THEN 0 ELSE ROUND(r.ppv - r.base_remboursement * g.taux_ald / 100.0, 2) END AS reste_a_charge_ald,
        r.code_groupe
FROM remboursement r
JOIN regime g ON g.code = r.regime
WHERE r.remboursable = 1
  AND r.base_remboursement IS NOT NULL
  AND r.ppv IS NOT NULL;

-- Le meme calcul, rattache a une fiche du catalogue.
CREATE VIEW v_remboursement AS
SELECT  m.id                        AS medicament_id,
        m.name                      AS medicament,
        r.regime,
        r.ean13,
        m.ppv                       AS ppv_catalogue,
        r.ppv                       AS ppv_organisme,
        r.base_remboursement        AS base,
        COALESCE(r.taux, g.taux_ambulatoire) AS taux_applique,
        ROUND(r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2)
                                    AS montant_rembourse,
        CASE WHEN ROUND(COALESCE(m.ppv, r.ppv) - r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2) < 0 THEN 0 ELSE ROUND(COALESCE(m.ppv, r.ppv) - r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2) END
                                    AS reste_a_charge,
        ROUND(r.base_remboursement * g.taux_ald / 100.0, 2) AS montant_rembourse_ald,
        CASE WHEN ROUND(COALESCE(m.ppv, r.ppv) - r.base_remboursement * g.taux_ald / 100.0, 2) < 0 THEN 0 ELSE ROUND(COALESCE(m.ppv, r.ppv) - r.base_remboursement * g.taux_ald / 100.0, 2) END
                                    AS reste_a_charge_ald,
        mr.match_score, mr.match_method
FROM medicament_remboursement mr
JOIN medicament   m ON m.id = mr.medicament_id
JOIN remboursement r ON r.regime = mr.regime AND r.ean13 = mr.ean13
JOIN regime        g ON g.code = r.regime
WHERE r.remboursable = 1
  AND r.base_remboursement IS NOT NULL
  AND mr.match_score >= 90;   -- nom + dosage + conditionnement concordants

-- CNSS et CNOPS cote a cote pour un meme code-barres.
CREATE VIEW v_comparatif_regimes AS
SELECT  c.ean13,
        c.nom                    AS medicament,
        c.dci,
        c.ppv,
        c.base_remboursement     AS base_cnss,
        c.taux                   AS taux_cnss,
        ROUND(c.base_remboursement * c.taux / 100.0, 2) AS rembourse_cnss,
        o.base_remboursement     AS base_cnops,
        ROUND(o.base_remboursement * 70.0 / 100.0, 2)   AS rembourse_cnops,
        CASE WHEN c.remboursable = 1 AND o.remboursable = 1 THEN 'Les deux'
             WHEN c.remboursable = 1 THEN 'CNSS seulement'
             WHEN o.remboursable = 1 THEN 'CNOPS seulement'
             ELSE 'Aucun' END AS couverture
FROM remboursement c
JOIN remboursement o ON o.ean13 = c.ean13 AND o.regime = 'CNOPS'
WHERE c.regime = 'CNSS';

-- Equivalence 1 — meme(s) principe(s) actif(s).
CREATE VIEW v_equivalents_dci AS
SELECT  a.id AS medicament_id, a.name AS medicament,
        b.id AS equivalent_id, b.name AS equivalent,
        b.ppv AS equivalent_ppv, b.ppv_unitaire AS equivalent_ppv_unitaire,
        b.is_generique, a.dci_key
FROM medicament a
JOIN medicament b ON b.dci_key = a.dci_key AND b.id <> a.id
WHERE a.dci_key <> '';

-- Equivalence 2 — substituable : meme DCI + meme dosage + meme forme.
-- Les prix sont compares a l'unite, sinon une boite de 10 paraitrait moins
-- chere qu'une boite de 30 du meme produit.
CREATE VIEW v_equivalents_generique AS
SELECT  a.id            AS medicament_id,
        a.name          AS medicament,
        a.pack_size     AS conditionnement,
        a.ppv           AS ppv,
        a.ppv_unitaire  AS ppv_unitaire,
        b.id            AS equivalent_id,
        b.name          AS equivalent,
        b.pack_size     AS equivalent_conditionnement,
        b.ppv           AS equivalent_ppv,
        b.ppv_unitaire  AS equivalent_ppv_unitaire,
        a.unite_conditionnement AS unite,
        b.unite_conditionnement AS equivalent_unite,
        CASE WHEN a.unite_conditionnement = b.unite_conditionnement
             THEN ROUND(a.ppv_unitaire - b.ppv_unitaire, 4) END AS economie_unitaire,
        CASE WHEN a.unite_conditionnement = b.unite_conditionnement AND a.ppv_unitaire > 0
             THEN ROUND(100.0 * (a.ppv_unitaire - b.ppv_unitaire) / a.ppv_unitaire, 1) END
                        AS economie_pct,
        CASE WHEN b.is_princeps = 1 THEN 'Princeps' ELSE 'Generique' END AS equivalent_type,
        a.equiv_key
FROM medicament a
JOIN medicament b ON b.equiv_key = a.equiv_key AND b.id <> a.id
WHERE a.equiv_key <> '';

-- Equivalence 3 — groupe de substitution OFFICIEL publie par la CNOPS.
-- C'est la reference opposable : deux produits du meme CODE_GROUPE sont
-- reconnus interchangeables par l'organisme.
CREATE VIEW v_equivalents_officiels AS
SELECT  a.ean13              AS ean13,
        a.nom                AS medicament,
        a.dosage || ' ' || COALESCE(a.unite_dosage, '') AS dosage,
        a.forme              AS forme,
        a.presentation       AS presentation,
        a.categorie          AS type,
        a.ppv                AS ppv,
        b.ean13              AS equivalent_ean13,
        b.nom                AS equivalent,
        b.dosage || ' ' || COALESCE(b.unite_dosage, '') AS equivalent_dosage,
        b.forme              AS equivalent_forme,
        b.presentation       AS equivalent_presentation,
        b.categorie          AS equivalent_type,
        b.ppv                AS equivalent_ppv,
        b.base_remboursement AS equivalent_base,
        ROUND(a.ppv - b.ppv, 2) AS economie,
        CASE WHEN a.ppv > 0 THEN ROUND(100.0 * (a.ppv - b.ppv) / a.ppv, 1) END AS economie_pct,
        a.code_groupe
FROM remboursement a
JOIN remboursement b
  ON b.code_groupe = a.code_groupe AND b.regime = a.regime AND b.ean13 <> a.ean13
WHERE a.regime = 'CNOPS' AND a.code_groupe IS NOT NULL;

-- Le substituable le moins cher (a l'unite) pour chaque medicament.
CREATE VIEW v_alternative_moins_chere AS
SELECT  a.id           AS medicament_id,
        a.name         AS medicament,
        a.ppv_unitaire AS ppv_unitaire,
        b.id           AS alternative_id,
        b.name         AS alternative,
        b.ppv_unitaire AS alternative_ppv_unitaire,
        ROUND(100.0 * (a.ppv_unitaire - b.ppv_unitaire) / a.ppv_unitaire, 1) AS economie_pct
FROM medicament a
JOIN medicament b ON b.equiv_key = a.equiv_key AND b.id <> a.id
WHERE a.equiv_key <> ''
  AND a.ppv_unitaire IS NOT NULL AND b.ppv_unitaire IS NOT NULL
  AND a.unite_conditionnement IS NOT NULL
  AND b.unite_conditionnement = a.unite_conditionnement
  AND b.ppv_unitaire = (SELECT MIN(c.ppv_unitaire) FROM medicament c
                        WHERE c.equiv_key = a.equiv_key AND c.ppv_unitaire IS NOT NULL
                          AND c.unite_conditionnement = a.unite_conditionnement)
  AND b.ppv_unitaire < a.ppv_unitaire;

-- Equivalence 4 — meme classe ATC niveau 4 (alternative therapeutique).
CREATE VIEW v_equivalents_atc AS
SELECT  a.id AS medicament_id, a.name AS medicament,
        b.id AS equivalent_id, b.name AS equivalent,
        b.ppv AS equivalent_ppv, a.atc_niveau4
FROM medicament a
JOIN medicament b ON b.atc_niveau4 = a.atc_niveau4 AND b.id <> a.id
WHERE a.atc_niveau4 IS NOT NULL AND a.atc_niveau4 <> '';
