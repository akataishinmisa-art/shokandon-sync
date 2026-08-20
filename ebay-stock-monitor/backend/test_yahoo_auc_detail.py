import httpx
from bs4 import BeautifulSoup
import re
import asyncio

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_yahoo_auc():
    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
        # ヤフオク検索
        r = await client.get("https://auctions.yahoo.co.jp/search/search?p=Canon+PowerShot+S110&va=Canon+PowerShot+S110&s1=new&o1=d&n=5")
        s = BeautifulSoup(r.text, "html.parser")
        items = s.find_all("li", class_=re.compile(r"Product"))
        for it in items[:3]:
            a = it.find("a", class_=re.compile(r"Product__titleLink|Product__title"))
            if a:
                url = a["href"]
                print(f"Fetching Yahoo item: {url}")
                r_item = await client.get(url)
                s_item = BeautifulSoup(r_item.text, "html.parser")
                cond = "None"
                ship = "None"
                for dt in s_item.find_all(["dt", "th"]):
                    text_th = dt.text.strip()
                    dd = dt.find_next_sibling(["dd", "td"])
                    if dd:
                        text_dd = dd.text.strip().replace("\n", "")
                        if "状態" in text_th: cond = text_dd[:20]
                        if "発送までの日数" in text_th or "発送日" in text_th: ship = text_dd[:20]
                print("Result Yahoo:", cond, "|", ship)

asyncio.run(test_yahoo_auc())
