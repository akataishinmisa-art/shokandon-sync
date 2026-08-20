import httpx
from bs4 import BeautifulSoup

url = "https://item.fril.jp/efe246b805098b2357f0931f9043885d"
r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(r.text, "html.parser")

table = soup.find("table")
for tr in soup.find_all("tr"):
    th = tr.find("th")
    td = tr.find("td")
    if th and td:
        safe_th = th.text.strip().encode('ascii', errors='replace').decode('ascii')
        safe_td = td.text.strip().encode('ascii', errors='replace').decode('ascii')
        print(f"{safe_th}: {safe_td}")
        if "発送" in th.text or "目安" in th.text:
            print("--> RAW UTF-8 Shipping:", td.text.strip())

# 出品者情報
seller = soup.find(class_=re.compile(r"seller|shop"))
print("Seller text:", seller.text.strip() if seller else "None")
