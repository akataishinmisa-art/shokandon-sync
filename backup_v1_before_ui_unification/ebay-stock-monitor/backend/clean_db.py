import sqlite3
import os

db_path = "data/monitor.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM detections")
    conn.commit()
    print("All detections reset. Cleaned rows:", cur.rowcount)
    conn.close()
