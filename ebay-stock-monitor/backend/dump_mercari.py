import httpx
import re

resp = httpx.get("https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale", headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
})

with open("backend/mercari_dump.html", "w", encoding="utf-8") as f:
    f.write(resp.text)

print("Dumped mercari_dump.html successfully.")
