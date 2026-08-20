import asyncio
import httpx
from bs4 import BeautifulSoup
import json
import urllib.parse

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_yflea_next_data():
    kw = "PlayStation Vita PCH-2000"
    encoded_kw = urllib.parse.quote(kw)
    url = f"https://paypayfleamarket.yahoo.co.jp/search/{encoded_kw}?open=1&sort=-openTime"
    
    with open("yflea_nextdata_test.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "html.parser")
            script = soup.find("script", id="__NEXT_DATA__")
            if script:
                data = json.loads(script.string)
                items = data.get("props", {}).get("pageProps", {}).get("items", [])
                out.write(f"Items in __NEXT_DATA__: {len(items)}\n")
                for it in items[:10]:
                    title = it.get("title", "")
                    price = it.get("price", 0)
                    cond = it.get("itemCondition", {}).get("name", "N/A")
                    ship = it.get("shipmentDays", {}).get("name", "N/A")
                    item_id = it.get("id", "")
                    out.write(f"ID: {item_id} | Price: ¥{price} | Cond: {cond} | Ship: {ship} | Title: {title[:35]}\n")
            else:
                out.write("No __NEXT_DATA__ script found!\n")

if __name__ == "__main__":
    asyncio.run(test_yflea_next_data())
