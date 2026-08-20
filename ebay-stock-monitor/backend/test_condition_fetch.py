import httpx
from bs4 import BeautifulSoup
import re
import asyncio

async def test_condition_fetch():
    headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
        # 1. ヤフオク
        print("=== Yahoo Auction Condition ===")
        r_y = await client.get("https://auctions.yahoo.co.jp/search/search?p=Canon+PowerShot+S110&va=Canon+PowerShot+S110&s1=new&o1=d&n=5")
        s_y = BeautifulSoup(r_y.text, "html.parser")
        for item in s_y.find_all("li", class_=re.compile(r"Product"))[:3]:
            title = item.find("a", class_=re.compile(r"Product__titleLink|Product__title")).text.strip()
            # ヤフオク一覧ページ内の状態
            cond_el = item.find(class_=re.compile(r"Product__status|status|condition"))
            print(f"Title: {title[:20]} | Cond (List): {cond_el.text.strip() if cond_el else 'None'}")
            
        # 2. ラクマ
        print("\n=== Rakuma Condition ===")
        r_r = await client.get("https://fril.jp/s?query=PowerShot+S110&transaction=selling")
        s_r = BeautifulSoup(r_r.text, "html.parser")
        first_r = s_r.find("a", href=re.compile(r"item.fril.jp"))
        if first_r:
            r_det = await client.get(first_r["href"])
            s_det = BeautifulSoup(r_det.text, "html.parser")
            for tr in s_det.find_all("tr"):
                if "商品の状態" in tr.text:
                    print("Rakuma detail condition:", tr.find("td").text.strip())

asyncio.run(test_condition_fetch())
