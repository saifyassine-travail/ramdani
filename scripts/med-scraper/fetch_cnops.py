#!/usr/bin/env python3
"""
Fetch the official CNOPS list of reimbursable medicines.

Source: https://www.cnops.org.ma/fr/node/227 ("Médicaments remboursables"),
whose page calls `/cnops/medicaments/` and returns the whole catalogue as JSON.

Per row CNOPS publishes: EAN-13 (CODE), libelle, DCI, dosage + unite, forme,
presentation, REMBOURSABLE (OUI/NON), PRIX_PPV, **PRIX_PBR** (base de
remboursement), PRINCEPS (P/G), **CODE_GROUPE** (official substitution group)
and CODE_PRINCEPS (the princeps a generic refers to).
"""
import json
import sys
import time

import requests

BASE = "https://www.cnops.org.ma"
ENDPOINT = BASE + "/cnops/medicaments/"
REFERER = BASE + "/fr/node/227"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def main(out_path: str):
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": REFERER,
        "X-Requested-With": "XMLHttpRequest",
    })
    # the CNOPS certificate chain is incomplete on this host; the payload is a
    # public, unauthenticated list, so verification is disabled deliberately.
    data = None
    for attempt in range(4):
        try:
            r = s.get(ENDPOINT, timeout=300, verify=False)
            if r.status_code == 200:
                data = r.json()
                break
            time.sleep(3 * (attempt + 1))
        except (requests.RequestException, ValueError) as exc:
            print("  attempt {} failed: {}".format(attempt + 1, exc), flush=True)
            time.sleep(3 * (attempt + 1))
    if data is None:
        print("CNOPS: could not fetch", flush=True)
        return 1

    with open(out_path, "w", encoding="utf-8") as fh:
        for rec in data:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print("CNOPS: {} rows -> {}".format(len(data), out_path), flush=True)
    return 0


if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    sys.exit(main(sys.argv[1]))
