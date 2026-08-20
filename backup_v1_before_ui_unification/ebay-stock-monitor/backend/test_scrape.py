import httpx
from bs4 import BeautifulSoup
import urllib.parse
import re

kw = urllib.parse.quote("Canon PowerShot S110")
url = f"https://auctions.yahoo.co.jp/search/search?p={kw}&va={kw}&s1=new&o1=d"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

resp = httpx.get(url, headers=headers)
print("Status:", resp.status_code)
soup = BeautifulSoup(resp.text, "html.parser")

# ヤフオクのアイテムリスト
items = soup.find_all("li", class_=re.compile(r"Product"))
print("Products count:", len(items))

for item in items[:10]:
    title_a = item.find("a", class_=re.compile(r"Product__titleLink|Product__title"))
    price_span = item.find("span", class_=re.compile(r"Product__priceValue"))
    img_tag = item.find("img")
    
    if title_a and price_span:
        title = title_a.text.strip()
        link = title_a.get("href")
        price_num = re.sub(r"[^\d]", "", price_span.text)
        img_src = img_tag.get("src") if img_tag else ""
        print(f"[{price_num}円] {title[:30]} -> {link[:50]}")
