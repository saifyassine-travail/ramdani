#!/usr/bin/env python3
"""
Scrape medicament.ma product pages into JSONL.

URLs come from the site's own sitemap (robots.txt allows /medicament/ and only
disallows /wp-admin/). Pages are plain server-rendered HTML with a stable
`detail-item / detail-header / detail-content` structure, so parsing is exact
rather than heuristic.

Usage:
  scrape_medicaments.py <urls.txt> <out.jsonl> [--limit N] [--filter-prefix a]
                        [--workers N] [--resume]
"""
import argparse, json, os, re, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
import requests
from bs4 import BeautifulSoup

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
SESSION_LOCAL = threading.local()
WRITE_LOCK = threading.Lock()

# "Signaler une erreur" links carry the WordPress post id, which is also the id
# used by the site's own autocomplete API — a stable primary key.
ID_RE = re.compile(r"reportError=(\d+)")
# Titles carry short status flags, e.g. "ABSTRAL 100 µG, Comprimé sublingual [P] [SS]"
FLAG_RE = re.compile(r"\[([^\]]{1,6})\]")
DATE_UPDATED_RE = re.compile(r"Mise à jour le:\s*([^<]+?)\s*$", re.M)
DATE_ADDED_RE = re.compile(r"Ajouté le:\s*([^<]+?)\s*$", re.M)


def session() -> requests.Session:
    s = getattr(SESSION_LOCAL, "s", None)
    if s is None:
        s = requests.Session()
        s.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})
        SESSION_LOCAL.s = s
    return s


def clean(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "")).strip()


def fetch(url: str, tries: int = 4) -> str | None:
    for i in range(tries):
        try:
            r = session().get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            if r.status_code == 404:
                return None
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (i + 1))
                continue
            return None
        except requests.RequestException:
            time.sleep(1.5 * (i + 1))
    return None


def parse_page(url: str, html: str) -> dict | None:
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one("h1.main-title")
    if not h1:
        return None

    raw_title = clean(h1.get_text())
    rec: dict = {
        "url": url,
        "slug": url.rstrip("/").rsplit("/", 1)[-1],
        "title": raw_title,
        "title_flags": FLAG_RE.findall(raw_title),
    }

    # "NAME 500 MG, Comprimé pelliculé [P]" -> brand + galenic form, flags removed
    title = clean(FLAG_RE.sub("", raw_title))
    if "," in title:
        head, _, tail = title.rpartition(",")
        rec["brand_label"] = clean(head)
        rec["form"] = clean(tail) or None
    else:
        rec["brand_label"], rec["form"] = title, None

    m = ID_RE.search(html)
    rec["site_id"] = int(m.group(1)) if m else None

    rec["tags"] = [clean(t.get_text()) for t in soup.select(".tags .tag")]

    for item in soup.select(".medicine-details .detail-item"):
        head = item.select_one(".detail-header")
        body = item.select_one(".detail-content")
        if not head or not body:
            continue
        key = clean(head.get_text())
        rec.setdefault("details", {})[key] = clean(body.get_text(" "))
        link = body.select_one("a[href]")
        if link and "/laboratoire/" in link["href"]:
            rec["lab_url"] = link["href"]

    text = soup.get_text("\n")
    for label, key in ((DATE_UPDATED_RE, "updated_label"), (DATE_ADDED_RE, "added_label")):
        mm = label.search(text)
        if mm:
            rec[key] = clean(mm.group(1))
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("urls")
    ap.add_argument("out")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--filter-prefix", default="")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--resume", action="store_true")
    a = ap.parse_args()

    urls = [u.strip() for u in open(a.urls, encoding="utf-8") if u.strip()]
    if a.filter_prefix:
        pref = f"/medicament/{a.filter_prefix.lower()}"
        urls = [u for u in urls if u.lower().startswith("https://medicament.ma" + pref)]
    urls.sort()
    if a.limit:
        urls = urls[: a.limit]

    done: set[str] = set()
    if a.resume and os.path.exists(a.out):
        with open(a.out, encoding="utf-8") as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["url"])
                except Exception:
                    pass
        urls = [u for u in urls if u not in done]
        print(f"resume: {len(done)} already scraped, {len(urls)} left", flush=True)

    print(f"scraping {len(urls)} pages with {a.workers} workers", flush=True)
    out = open(a.out, "a" if a.resume else "w", encoding="utf-8")
    stats = {"ok": 0, "fail": 0}

    def work(u: str):
        html = fetch(u)
        if not html:
            with WRITE_LOCK:
                stats["fail"] += 1
            return
        rec = parse_page(u, html)
        if not rec:
            with WRITE_LOCK:
                stats["fail"] += 1
            return
        with WRITE_LOCK:
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            stats["ok"] += 1
            n = stats["ok"] + stats["fail"]
            if n % 200 == 0:
                out.flush()
                print(f"  {n}/{len(urls)}  ok={stats['ok']} fail={stats['fail']}", flush=True)

    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        list(ex.map(work, urls))
    out.close()
    print(f"done: ok={stats['ok']} fail={stats['fail']} -> {a.out}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
