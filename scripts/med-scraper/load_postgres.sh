#!/usr/bin/env bash
# Load the generated catalogue into the MediAssist PostgreSQL database.
#
# Everything lands in its own schema (default: med_ref) so the application's
# own `medicaments` table is never touched. Re-runnable: the schema is dropped
# and rebuilt from the generated SQL.
#
#   ./load_postgres.sh out/medicaments_ma.sql [schema] [container]
set -euo pipefail

SQL_FILE="${1:-out/medicaments_ma.sql}"
SCHEMA="${2:-med_ref}"
CONTAINER="${3:-mediassist_db}"
DB="${PGDATABASE:-mediassist}"
USER="${PGUSER:-postgres}"

[ -f "$SQL_FILE" ] || { echo "missing $SQL_FILE" >&2; exit 1; }

echo "==> resetting schema $SCHEMA in $DB"
docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 <<SQL
DROP SCHEMA IF EXISTS $SCHEMA CASCADE;
CREATE SCHEMA $SCHEMA;
SQL

echo "==> loading $SQL_FILE"
# search_path makes the unqualified CREATE/INSERT statements land in $SCHEMA.
{ echo "SET search_path TO $SCHEMA;"; cat "$SQL_FILE"; } \
  | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -q

echo "==> done"
docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -c \
  "SELECT 'medicament' t, COUNT(*) FROM $SCHEMA.medicament
   UNION ALL SELECT 'remboursement', COUNT(*) FROM $SCHEMA.remboursement
   UNION ALL SELECT 'substance', COUNT(*) FROM $SCHEMA.substance
   UNION ALL SELECT 'rembourses CNSS', COUNT(*) FROM $SCHEMA.remboursement WHERE regime='CNSS' AND remboursable = 1
   UNION ALL SELECT 'rembourses CNOPS', COUNT(*) FROM $SCHEMA.remboursement WHERE regime='CNOPS' AND remboursable = 1;"
