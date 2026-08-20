import httpx
import re
import json

resp = httpx.get("https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale", headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
})

raw_text = resp.text

# mから始まる商品IDと価格、名前の抽出
# 例: "id":"m123456789","name":"...","price":30000
pattern = re.compile(r'\{"id":"(m\d+)","name":"([^"]+)","price":(\d+)[^}]*\}')
matches = pattern.findall(raw_text)

print(f"Found {len(matches)} items via regex in Next.js stream!")
for m_id, name, price in matches[:10]:
    try:
        decoded_name = name.encode('utf-8').decode('unicode-escape')
    except:
        decoded_name = name
    print(f"[{price}円] {decoded_name[:30]} -> https://jp.mercari.com/item/{m_id}")
