import httpx
from bs4 import BeautifulSoup
import urllib.parse
import re

kw = urllib.parse.quote("Canon PowerShot S110")
url = f"https://fril.jp/s?query={kw}&transaction=selling"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

resp = httpx.get(url, headers=headers)
soup = BeautifulSoup(resp.text, "html.parser")
items = soup.find_all("div", class_=re.compile(r"item"))

print(f"Total Rakuma items: {len(items)}")
for it in items[:5]:
    img_tag = it.find("img")
    if img_tag:
        print("IMG attributes:", img_tag.attrs)
