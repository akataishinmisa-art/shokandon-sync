import asyncio
import httpx
from bs4 import BeautifulSoup
import re

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

# テスト用URL
test_urls = [
    # ヤフオク
    "https://auctions.yahoo.co.jp/jp/auction/o1226764555",
    "https://auctions.yahoo.co.jp/jp/auction/k1230977523",
    # Yahoo!フリマ
    "https://paypayfleamarket.yahoo.co.jp/item/w1223409468",
    "https://paypayfleamarket.yahoo.co.jp/item/k1228944515"
]

async def test():
    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
        for url in test_urls:
            print(f"\n--- URL: {url} ---")
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"Failed with status: {resp.status_code}")
                continue
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # 状態と発送日数の抽出
            cond = None
            ship = None
            
            # ヤフオク
            if "auctions.yahoo.co.jp" in url:
                for el in soup.find_all(["dt", "th", "span", "div"]):
                    txt = el.text.strip()
                    if "状態" in txt and not cond:
                        sib = el.find_next_sibling(["dd", "td", "span", "p"])
                        if sib:
                            cond = sib.text.strip()
                    if ("発送までの日数" in txt or "発送日" in txt) and not ship:
                        sib = el.find_next_sibling(["dd", "td", "span", "p"])
                        if sib:
                            ship = sib.text.strip()
            
            # Yahoo!フリマ
            elif "paypayfleamarket" in url:
                for el in soup.find_all(["dt", "th", "span", "p", "div"]):
                    txt = el.text.strip()
                    if "商品の状態" == txt and not cond:
                        sib = el.find_next_sibling()
                        if sib:
                            cond = sib.text.strip()
                    if "発送までの日数" == txt and not ship:
                        sib = el.find_next_sibling()
                        if sib:
                            ship = sib.text.strip()
            
            print(f"Condition: {cond}")
            print(f"Shipping: {ship}")

if __name__ == "__main__":
    asyncio.run(test())
