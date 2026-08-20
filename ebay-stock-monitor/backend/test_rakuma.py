import httpx
import urllib.parse
from bs4 import BeautifulSoup
import re

# 楽天ラクマの検索テスト
kw = urllib.parse.quote("Canon PowerShot S110")
url = f"https://fril.jp/s?query={kw}&transaction=selling"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

resp = httpx.get(url, headers=headers)
print("Rakuma Status:", resp.status_code)
soup = BeautifulSoup(resp.text, "html.parser")
items = soup.find_all("div", class_=re.compile(r"item"))
print("Rakuma Items found:", len(items))
for it in items[:10]:
    title_elem = it.find("img")
    price_elem = it.find(class_=re.compile(r"item-box__item-price|price"))
    link_elem = it.find("a", href=re.compile(r"item.fril.jp"))
    if link_elem and price_elem:
        print(link_elem.get("href"), "-->", title_elem.get("alt") if title_elem else "No title", price_elem.text.strip())
