#!/usr/bin/env python3
"""
Enumerate the live medicament.ma catalogue from its A–Z listing.

The sitemap is ~50% stale (dead slugs), so the alphabetical listing at
/listing-des-medicaments/?lettre=X&paged=N is used instead: it is server
rendered, 20 items per page, and reflects what the site actually serves.
Each item already carries name, presentation, PPV/PH and laboratory, which we
keep as a cross-check against the detail page.
"""
import json, re, string, sys, time
import requests
from bs4 import BeautifulSoup

BASE = "https://medicament.ma/listing-des-medicaments/"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def get(s, url, tries=4):
    for i in range(tries):
        try:
            r = s.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (i + 1)); continue
            return None
        except requests.RequestException:
            time.sleep(1.5 * (i + 1))
    return None


def main(out_path: str, letters: str, delay: float):
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})
    seen: set[str] = set()
    total = 0
    with open(out_path, "w", encoding="utf-8") as out:
        for letter in letters:
            page, empty_streak = 1, 0
            while True:
                html = get(s, f"{BASE}?lettre={letter}&paged={page}")
                if html is None:
                    empty_streak += 1
                    if empty_streak >= 2:
                        break
                    page += 1
                    continue
                soup = BeautifulSoup(html, "lxml")
                items = soup.select("li.listing-item")
                if not items:
                    break
                new = 0
                for li in items:
                    a = li.select_one("a[href]")
                    if not a:
                        continue
                    url = a["href"].split("?")[0]
                    if url in seen:
                        continue
                    seen.add(url)
                    new += 1
                    prim = li.select_one(".primary")
                    sec = li.select_one(".secondary")
                    out.write(json.dumps({
                        "url": url,
                        "letter": letter,
                        "listing_name": re.sub(r"\s+", " ", prim.get_text()).strip() if prim else None,
                        "listing_snapshot": re.sub(r"\s+", " ", sec.get_text()).strip() if sec else None,
                    }, ensure_ascii=False) + "\n")
                total += new
                # A page that adds nothing new means we've wrapped past the end.
                if new == 0:
                    break
                page += 1
                time.sleep(delay)
            print(f"  {letter}: {page - 1} pages, running total {total}", flush=True)
            out.flush()
    print(f"enumerated {total} unique products -> {out_path}", flush=True)


if __name__ == "__main__":
    out = sys.argv[1]
    letters = sys.argv[2] if len(sys.argv) > 2 else string.ascii_uppercase
    delay = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
    main(out, letters, delay)
