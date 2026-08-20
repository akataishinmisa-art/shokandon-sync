import httpx
from bs4 import BeautifulSoup

url = "https://item.fril.jp/efe246b805098b2357f0931f9043885d"
r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(r.text, "html.parser")

for tr in soup.find_all("tr"):
    th = tr.find("th")
    td = tr.find("td")
    if th and td:
        if "発送日の目安" in th.text or "発送日" in th.text:
            print("REAL SHIP VALUE:", td.text.strip().replace("\n", " "))
        if "配送料の負担" in th.text:
            print("REAL BURDEN VALUE:", td.text.strip().replace("\n", " "))
        if "発送元の地域" in th.text:
            print("REAL REGION VALUE:", td.text.strip().replace("\n", " "))
