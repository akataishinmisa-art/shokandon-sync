import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "monitor.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE target_items ADD COLUMN category TEXT DEFAULT '📁 未分類'")
except Exception:
    pass

cursor.execute("UPDATE target_items SET category = '🎮 ゲーム機本体' WHERE name LIKE '%2000%' OR name LIKE '%3DS%' OR name LIKE '%Vita%'")
cursor.execute("UPDATE target_items SET category = '📷 デジタルカメラ' WHERE name LIKE '%TZ3%' OR name LIKE '%S110%' OR name LIKE '%IXY%' OR name LIKE '%PowerShot%' OR name LIKE '%LUMIX%'")
conn.commit()

cursor.execute("SELECT id, name, category FROM target_items")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}, Name: {r[1]}, Category: {r[2]}")

conn.close()
