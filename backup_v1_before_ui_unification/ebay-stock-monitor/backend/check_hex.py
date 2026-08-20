import httpx
from bs4 import BeautifulSoup

url = "https://item.fril.jp/efe246b805098b2357f0931f9043885d"
r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(r.text, "html.parser")

for tr in soup.find_all("tr"):
    th = tr.find("th")
    td = tr.find("td")
    if th and td and "発送日の目安" in th.text:
        val = td.text.strip()
        print("Hex codes:", [hex(ord(c)) for c in val])
