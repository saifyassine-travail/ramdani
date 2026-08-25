"""Read-only access to the `research_cases` table — ~253k de-identified
clinical case records imported separately from public sources (PMC-Patients,
E3C Corpus). Same `mediassist` Postgres DB as source_db.py, never writes
here. Used to bootstrap training data for the summarizer while there are
zero real reviewed appointments yet (see scripts/import_research_cases.py).
"""
import psycopg2.extras

from .source_db import _connect

# (source, language, n) — one-off stratified sample: 100 PMC-Patients (en) +
# 20 each of the 5 E3C languages = 200 rows total. Exact reproducibility
# doesn't matter here, so a plain `ORDER BY random() LIMIT n` per group is
# good enough.
DEFAULT_GROUPS = [
    ("pmc_patients", "en", 100),
    ("e3c", "en", 20),
    ("e3c", "fr", 20),
    ("e3c", "it", 20),
    ("e3c", "es", 20),
    ("e3c", "eu", 20),
]


def fetch_research_sample(groups=None):
    """Independent random sample per (source, language) group. Returns a
    flat list of dict rows with id, source, source_id, language, age,
    gender, title, summary_text, entities."""
    groups = groups or DEFAULT_GROUPS
    rows = []
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for source, language, n in groups:
                if n <= 0:
                    continue
                cur.execute(
                    """
                    SELECT id, source, source_id, language, age, gender,
                           title, summary_text, entities
                    FROM research_cases
                    WHERE source = %s AND language = %s
                    ORDER BY random()
                    LIMIT %s
                    """,
                    (source, language, n),
                )
                rows.extend(cur.fetchall())
    return rows
