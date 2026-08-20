import httpx
from bs4 import BeautifulSoup
import re

url = "https://fril.jp/s?query=Canon%20PowerShot%20S10&transaction=selling"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

resp = httpx.get(url, headers=headers)
soup = BeautifulSoup(resp.text, "html.parser")
items = soup.find_all("div", class_=re.compile(r"item"))

print(f"Total items found: {len(items)}")
for it in items:
    a = it.find("a", href=re.compile(r"item.fril.jp"))
    if a:
        item_url = a["href"]
        r_item = httpx.get(item_url, headers=headers)
        s_item = BeautifulSoup(r_item.text, "html.parser")
        
        shipping_val = "未取得"
        for tr in s_item.find_all("tr"):
            th = tr.find("th")
            td = tr.find("td")
            if th and td and ("発送日の目安" in th.text or "発送日" in th.text):
                shipping_val = td.text.strip().replace("\n", "")
                break
                
        # タイトル
        title_img = it.find("img")
        title = title_img.get("alt", "") if title_img else "No title"
        
        # 安全に出力
        safe_title = title[:30].encode('ascii', errors='replace').decode('ascii')
        safe_ship = shipping_val.encode('ascii', errors='replace').decode('ascii')
        print(f"URL: {item_url} | Ship: {safe_ship}")
        print("Raw shipping chars:", [hex(ord(c)) for c in shipping_val])
