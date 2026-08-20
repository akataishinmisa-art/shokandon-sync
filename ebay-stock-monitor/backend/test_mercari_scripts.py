import httpx
from bs4 import BeautifulSoup
import re
import json

resp = httpx.get("https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale", headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
soup = BeautifulSoup(resp.text, "html.parser")

scripts = soup.find_all("script")
print("Total scripts:", len(scripts))
for i, s in enumerate(scripts):
    txt = s.string or ""
    if "PowerShot" in txt or "30000" in txt or "items" in txt:
        print(f"Script {i} contains keywords! Length: {len(txt)}")
        # 最初の200文字
        print(txt[:200])
