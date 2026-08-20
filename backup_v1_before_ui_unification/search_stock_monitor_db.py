import os

backend_dir = r"C:\Users\akata\.gemini\antigravity\scratch\ebay-stock-monitor\backend"
with open(os.path.join(backend_dir, "database.py"), "r", encoding="utf-8") as f:
    db_code = f.read()

lines = db_code.split("\n")
print("=== database.py matching lines ===")
for i, l in enumerate(lines):
    if "def get_" in l or "SELECT" in l:
        print(f"Line {i+1}: {l[:100]}")
