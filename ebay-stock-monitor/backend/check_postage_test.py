import asyncio
import httpx
from bs4 import BeautifulSoup
import re

async def check_postage():
    url = "https://auctions.yahoo.co.jp/search/search?p=LUMIX+DMC-TZ5&va=LUMIX+DMC-TZ5&is_postage_mode=1&dest_pref_code=13&exflg=1&b=1&n=50&s1=new&o1=d"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    async with httpx.AsyncClient(headers=headers) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.find_all("li", class_=re.compile(r"Product"))
        for it in items[:5]:
            title = it.find("a", class_=re.compile(r"Product__title"))
            t_text = title.text.strip() if title else ""
            print("--- ITEM:", t_text[:30])
            
            # 送料に関連する要素を探す
            postage_els = it.find_all(class_=re.compile(r"postage|delivery|Shipping|Price", re.I))
            for el in postage_els:
                print("  Class:", el.get("class"), "Text:", el.text.strip()[:40])
            
            # すべてのテキストから送料らしきものを探す
            full_txt = it.get_text(separator=" | ", strip=True)
            print("  Full text snippet:", full_txt[:100])

if __name__ == "__main__":
    asyncio.run(check_postage())
