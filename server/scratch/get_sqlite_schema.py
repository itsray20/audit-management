import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../database.sqlite')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("auditor_counts schema:")
cursor.execute("SELECT sql FROM sqlite_master WHERE name='auditor_counts'")
row = cursor.fetchone()
if row:
    print(row[0])
else:
    print("Not found")

print("\nTriggers:")
cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='trigger'")
for r in cursor.fetchall():
    print(r[0], r[1])

conn.close()
