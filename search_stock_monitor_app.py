import os

backend_dir = r"C:\Users\akata\.gemini\antigravity\scratch\ebay-stock-monitor\backend"
with open(os.path.join(backend_dir, "app.py"), "r", encoding="utf-8") as f:
    app_code = f.read()

lines = app_code.split("\n")
print("=== app.py matching lines ===")
for i, l in enumerate(lines):
    if "items" in l or "keyword" in l or "filter" in l or "pickup" in l or "latest" in l:
        if i < 150 or "pickup" in l or "filter" in l or "items" in l:
            print(f"Line {i+1}: {l[:100]}")
