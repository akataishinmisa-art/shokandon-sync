import httpx
import urllib.parse
from bs4 import BeautifulSoup
import re

# Yahoo!フリマ（旧PayPayフリマ）の検索テスト
kw = urllib.parse.quote("Canon PowerShot S110")
url = f"https://paypayfleamarket.yahoo.co.jp/search/{kw}"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

resp = httpx.get(url, headers=headers)
print("Yahoo Fleamarket Status:", resp.status_code)
soup = BeautifulSoup(resp.text, "html.parser")
items = soup.find_all("a", href=re.compile(r"/item/"))
print("Yahoo Fleamarket Items found:", len(items))
for it in items[:10]:
    title_elem = it.find("img")
    price_elem = it.find(string=re.compile(r"円"))
    print(it.get("href"), "-->", title_elem.get("alt") if title_elem else "No title", price_elem)
