import sqlite3
import psycopg2

# ==============================
# SQLite connection
# ==============================
sqlite_conn = sqlite3.connect(
    "/Users/imachd/Desktop/mediassist/ramdani/medicaments.db"
)
sqlite_cursor = sqlite_conn.cursor()

# ==============================
# PostgreSQL connection
# ==============================
pg_conn = psycopg2.connect(
    host="127.0.0.1",
    port="5432",
    database="mediassist",
    user="postgres",
    password="YOUR_POSTGRES_PASSWORD"
)
pg_cursor = pg_conn.cursor()

# ==============================
# Fetch data from SQLite
# ==============================
sqlite_cursor.execute("""
    SELECT
        name,
        price,
        dosage,
        composition,
        Classe_thérapeutique,
        Code_ATCv
    FROM medicaments
""")

rows = sqlite_cursor.fetchall()
print(f"Found {len(rows)} records to migrate\n")

# ==============================
# Clean rows (PostgreSQL-safe)
# ==============================
def clean_row(row):
    name, price, dosage, composition, classe, code = row

    # 🚨 FORCE price to 0 if missing
    if price in ("", None):
        price = 0

    return (
        name,
        price,
        None if dosage == "" else dosage,
        None if composition == "" else composition,
        None if classe == "" else classe,
        None if code == "" else code,
    )

# ==============================
# Insert into PostgreSQL
# ==============================
insert_query = """
INSERT INTO medicaments (
    name,
    price,
    dosage,
    composition,
    "Classe_thérapeutique",
    "Code_ATCv"
)
VALUES (%s, %s, %s, %s, %s, %s)
"""

success = 0
failed = 0

for i, row in enumerate(rows, start=1):
    try:
        pg_cursor.execute(insert_query, clean_row(row))
        success += 1
    except Exception as e:
        pg_conn.rollback()
        failed += 1
        print(f"❌ Row {i} failed: {e}")

# Commit once
pg_conn.commit()

# ==============================
# Close connections
# ==============================
sqlite_cursor.close()
sqlite_conn.close()
pg_cursor.close()
pg_conn.close()

print("\n==============================")
print("Migration finished")
print(f"✅ Success: {success}")
print(f"❌ Failed: {failed}")
print("==============================")
