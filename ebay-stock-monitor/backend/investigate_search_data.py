import asyncio
import httpx
import re
import json
from bs4 import BeautifulSoup

async def investigate():
    # 1. Yahoo!フリマの検索ページ
    url_yf = "https://paypayfleamarket.yahoo.co.jp/search/PS%20Vita%20PCH-2000?open=1&sort=-openTime"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        resp = await client.get(url_yf)
        print("Yahoo Flea Search status:", resp.status_code)
        
        # __NEXT_DATA__ を探す
        soup = BeautifulSoup(resp.text, "html.parser")
        next_data = soup.find("script", id="__NEXT_DATA__")
        if next_data:
            data = json.loads(next_data.string)
            print("Found __NEXT_DATA__ in Yahoo Flea!")
            # itemsを探す
            with open("yahoo_flea_next_data.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("Saved yahoo_flea_next_data.json")
        else:
            print("No __NEXT_DATA__ found in Yahoo Flea, text len:", len(resp.text))
            if "制限" in resp.text:
                print(">>> Rate limited page detected in Flea")

    # 2. ヤフオクの検索ページ
    url_ya = "https://auctions.yahoo.co.jp/search/search?p=PS+Vita+PCH-2000&va=PS+Vita+PCH-2000&b=1&n=20&s1=new&o1=d"
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        resp = await client.get(url_ya)
        print("Yahoo Auction Search status:", resp.status_code)
        with open("yahoo_auction_search.html", "w", encoding="utf-8") as f:
            f.write(resp.text)
        print("Saved yahoo_auction_search.html")

if __name__ == "__main__":
    asyncio.run(investigate())
