#!/usr/bin/env bash
# Full refresh: catalogue + official reimbursement lists + database build.
#   ./run_all.sh          normal run (resumes the scrape)
#   ./run_all.sh --fresh  re-scrape everything from scratch
set -euo pipefail
cd "$(dirname "$0")"

R="docker run --rm -v $(pwd -W 2>/dev/null || pwd):/work medscraper"
LETTERS=ABCDEFGHIJKLMNOPQRSTUVWXYZ
[ "${1:-}" = "--fresh" ] && rm -f data/medicaments.jsonl

docker build -q -t medscraper . >/dev/null

echo "==> 1/5  catalogue medicament.ma : enumeration A-Z"
$R python enumerate_listing.py data/listing_all.jsonl "$LETTERS" 0.15
$R python -c "import json,sys; [sys.stdout.write(json.loads(l)['url']+'\n') for l in open('data/listing_all.jsonl',encoding='utf-8')]" \
  | sort -u > data/urls_all.txt

echo "==> 2/5  catalogue medicament.ma : fiches produit"
$R python scrape_medicaments.py data/urls_all.txt data/medicaments.jsonl --workers 5 --resume

echo "==> 3/5  liste officielle CNSS"
$R python fetch_cnss.py data/cnss_medicaments.jsonl 2000

echo "==> 4/5  liste officielle CNOPS"
$R python fetch_cnops.py data/cnops_medicaments.jsonl

echo "==> 5/5  construction de la base"
$R python build_db.py \
    --scraped data/medicaments.jsonl \
    --cnss    data/cnss_medicaments.jsonl \
    --cnops   data/cnops_medicaments.jsonl
