#!/usr/bin/env bash
# Load the generated catalogue into the MediAssist PostgreSQL database.
#
# Everything lands in its own schema (default: med_ref) so the application's
# own `medicaments` table is never touched. Re-runnable: the schema is dropped
# and rebuilt from the generated SQL.
#
#   ./load_postgres.sh dist/medicaments_ma.sql.gz [schema] [container]
#   ./load_postgres.sh out/medicaments_ma.sql     [schema] [container]
#
# Accepts the .gz straight from dist/ so a fresh clone needs no intermediate
# file — out/ is gitignored and therefore absent on a new machine, which used
# to make the documented `gunzip -c ... > out/...` fail with "No such file or
# directory" before anything was loaded.
set -euo pipefail

SQL_FILE="${1:-dist/medicaments_ma.sql.gz}"
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
# Read compressed or plain, so dist/*.sql.gz works without unpacking first.
case "$SQL_FILE" in
  *.gz) READ_SQL=(gzip -dc "$SQL_FILE") ;;
  *)    READ_SQL=(cat "$SQL_FILE") ;;
esac

# search_path makes the unqualified CREATE/INSERT statements land in $SCHEMA.
{ echo "SET search_path TO $SCHEMA;"; "${READ_SQL[@]}"; } \
  | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -q

echo "==> done"
docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -c \
  "SELECT 'medicament' t, COUNT(*) FROM $SCHEMA.medicament
   UNION ALL SELECT 'remboursement', COUNT(*) FROM $SCHEMA.remboursement
   UNION ALL SELECT 'substance', COUNT(*) FROM $SCHEMA.substance
   UNION ALL SELECT 'rembourses CNSS', COUNT(*) FROM $SCHEMA.remboursement WHERE regime='CNSS' AND remboursable = 1
   UNION ALL SELECT 'rembourses CNOPS', COUNT(*) FROM $SCHEMA.remboursement WHERE regime='CNOPS' AND remboursable = 1;"
