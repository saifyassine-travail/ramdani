#!/usr/bin/env python3
"""
Fetch the official CNSS list of medicines admitted to reimbursement.

Source: https://www.cnss.ma/fr/listes-des-medicaments
The page is a Next.js server component; the rows are embedded in the RSC
payload rather than served from a public JSON endpoint (the Drupal backend
sits on an internal host). The list is paginated and honours a `limit`
parameter, so a handful of large pages covers the whole catalogue.

Per row CNSS publishes: EAN-13, laboratoire, nom, DCI, dosage + unite, forme,
presentation, PPV, PH, **PPV - BR** (base de remboursement) and
**Taux Rembours** (the reimbursement rate actually applied, 0 / 70 / 100).
"""
import json
import re
import sys
import time

import requests

URL = "https://www.cnss.ma/fr/listes-des-medicaments"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Rows are flat objects, so a non-greedy scan between the first and last known
# key is enough - no brace balancing required.
ITEM_RE = re.compile(r'\{"id":"\d+","Code":.*?"Taux Rembours":(?:"[^"]*"|null)\}')
PAGINATION_RE = re.compile(r'"pagination":\{"page":(\d+),"limit":(\d+),"total":(\d+),"pages":(\d+)')


def unescape_rsc(html: str) -> str:
    """The RSC payload arrives as JS string literals; decode the escaping."""
    return html.encode("utf-8").decode("unicode_escape", errors="ignore") \
        if "\\u" in html[:4000] else html.replace('\\"', '"').replace("\\\\", "\\")


def fetch_page(session, page: int, limit: int, tries: int = 4):
    for attempt in range(tries):
        try:
            r = session.get(URL, params={"page": page, "limit": limit}, timeout=180)
            if r.status_code == 200:
                return r.text
            time.sleep(2 * (attempt + 1))
        except requests.RequestException:
            time.sleep(2 * (attempt + 1))
    return None


def main(out_path: str, limit: int = 2000):
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})

    rows, seen = [], set()
    page, pages, total = 1, None, None
    while pages is None or page <= pages:
        html = fetch_page(session, page, limit)
        if html is None:
            print("  page {}: failed".format(page), flush=True)
            break
        text = unescape_rsc(html)

        if pages is None:
            m = PAGINATION_RE.search(text)
            if m:
                total, pages = int(m.group(3)), int(m.group(4))
                # `pages` is reported for the default page size; recompute for ours
                pages = (total + limit - 1) // limit
                print("  total {} rows -> {} pages of {}".format(total, pages, limit), flush=True)
            else:
                pages = 1

        new = 0
        for chunk in ITEM_RE.findall(text):
            try:
                rec = json.loads(chunk)
            except json.JSONDecodeError:
                continue
            code = rec.get("Code")
            key = (code, rec.get("id"))
            if key in seen:
                continue
            seen.add(key)
            rows.append(rec)
            new += 1
        print("  page {}/{}: +{} (total {})".format(page, pages, new, len(rows)), flush=True)
        if new == 0:
            break
        page += 1

    with open(out_path, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("CNSS: {} rows -> {}".format(len(rows), out_path), flush=True)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2000)
