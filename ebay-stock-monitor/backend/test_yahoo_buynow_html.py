import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import urllib.parse

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test():
    kw = "PlayStation Vita PCH-2000"
    encoded_kw = urllib.parse.quote(kw)
    # 即決あり検索
    url = f"https://auctions.yahoo.co.jp/search/search?p={encoded_kw}&va={encoded_kw}&is_postage_mode=1&dest_pref_code=13&exflg=1&b=1&n=20&s1=bidorbuyprice&o1=d"
    
    with open("yahoo_buynow_html.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "html.parser")
            items = soup.find_all("li", class_=re.compile(r"Product"))
            out.write(f"Total: {len(items)}\n")
            for it in items[:5]:
                out.write(f"\n--- HTML of Item ---\n{str(it)}\n")

if __name__ == "__main__":
    asyncio.run(test())
