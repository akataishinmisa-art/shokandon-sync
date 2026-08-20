import httpx
from bs4 import BeautifulSoup
import re
import asyncio

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_shipping_fetch():
    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=10.0, follow_redirects=True) as client:
        # 1. ヤフオクの例 (auctions.yahoo.co.jp)
        # 2. ラクマの例 (item.fril.jp)
        
        # ラクマのテスト
        rakuma_url = "https://item.fril.jp/26f047e7048703bbbf9cf4ca07d8d217" # または任意のS110出品
        print("Testing Rakuma shipping fetch...")
        try:
            r = await client.get("https://fril.jp/s?query=PowerShot+S110&transaction=selling")
            soup = BeautifulSoup(r.text, "html.parser")
            first_link = soup.find("a", href=re.compile(r"item.fril.jp"))
            if first_link:
                detail_url = first_link["href"]
                r_detail = await client.get(detail_url)
                soup_d = BeautifulSoup(r_detail.text, "html.parser")
                for tr in soup_d.find_all("tr"):
                    if "発送日の目安" in tr.text or "発送日" in tr.text:
                        print("Rakuma shipping found:", tr.find("td").text.strip())
        except Exception as e:
            print("Rakuma error:", e)

asyncio.run(test_shipping_fetch())
