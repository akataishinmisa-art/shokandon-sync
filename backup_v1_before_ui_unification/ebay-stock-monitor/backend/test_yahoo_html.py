import httpx
from bs4 import BeautifulSoup
import re
import asyncio

async def test_yahoo_detail():
    url = "https://page.auctions.yahoo.co.jp/jp/auction/1172813589" # または実際のヤフオク出品URL
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0, follow_redirects=True) as client:
        r_list = await client.get("https://auctions.yahoo.co.jp/search/search?p=Canon+PowerShot+S110&va=Canon+PowerShot+S110&s1=new&o1=d&n=5")
        soup_l = BeautifulSoup(r_list.text, "html.parser")
        first_a = soup_l.find("a", class_=re.compile(r"Product__titleLink|Product__title"))
        if first_a:
            target_url = first_a["href"]
            if target_url.startswith("//"): target_url = "https:" + target_url
            print("Target URL:", target_url)
            r = await client.get(target_url)
            soup = BeautifulSoup(r.text, "html.parser")
            
            # dl / dt / dd 探索
            for dt in soup.find_all(["dt", "th"]):
                if "発送までの日数" in dt.text:
                    dd = dt.find_next_sibling(["dd", "td"])
                    print("Found sibling value:", dd.text.strip() if dd else "None")

asyncio.run(test_yahoo_detail())
