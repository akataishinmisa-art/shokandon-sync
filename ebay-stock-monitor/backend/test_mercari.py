import httpx
from bs4 import BeautifulSoup
import urllib.parse
import json

kw = urllib.parse.quote("Canon PowerShot S110")
url = f"https://jp.mercari.com/search?keyword={kw}&status=on_sale"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

resp = httpx.get(url, headers=headers)
print("Status:", resp.status_code)
soup = BeautifulSoup(resp.text, "html.parser")

# __NEXT_DATA__ があるか
next_data_script = soup.find("script", id="__NEXT_DATA__")
if next_data_script:
    print("Found __NEXT_DATA__!")
    try:
        data = json.loads(next_data_script.string)
        print("Keys in next_data:", list(data.get("props", {}).get("pageProps", {}).keys()))
    except Exception as e:
        print("JSON parse error:", e)
else:
    print("No __NEXT_DATA__ found.")

# aタグから商品リンクを探す
links = soup.find_all("a", href=lambda h: h and "/item/m" in h)
print("Found item links in HTML:", len(links))
for l in links[:5]:
    print(l.get("href"), l.text.strip())
