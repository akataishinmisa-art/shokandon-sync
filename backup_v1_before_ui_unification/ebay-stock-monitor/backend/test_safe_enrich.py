import asyncio
import httpx
import re
from bs4 import BeautifulSoup
from detail_enricher_robust import parse_yahoo_auction_html, parse_rakuma_html

async def test_enrich():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    }
    
    # 1. ヤフオクの商品
    ya_url = "https://page.auctions.yahoo.co.jp/jp/auction/1173617309"  # テストURL
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        # まずヤフオク検索で実在するURLを取得
        resp_s = await client.get("https://auctions.yahoo.co.jp/search/search?p=PS+Vita+PCH-2000&va=PS+Vita+PCH-2000&b=1&n=5&s1=new&o1=d")
        soup = BeautifulSoup(resp_s.text, "html.parser")
        a = soup.find("a", class_=re.compile(r"Product__titleLink|titleLink"))
        if a:
            target_url = a.get("href")
            print("Found Yahoo Auc URL:", target_url)
            resp = await client.get(target_url)
            print("Yahoo Auc Detail Status:", resp.status_code)
            cond, ship = parse_yahoo_auction_html(resp.text)
            print(f"Yahoo Auc Parsed -> Condition: '{cond}', Shipping: '{ship}'")

        # 2. ラクマの商品
        resp_r = await client.get("https://fril.jp/s?query=PS+Vita+PCH-2000&transaction=selling")
        soup_r = BeautifulSoup(resp_r.text, "html.parser")
        a_r = soup_r.find("a", href=re.compile(r"item.fril.jp"))
        if a_r:
            target_r_url = a_r.get("href")
            print("Found Rakuma URL:", target_r_url)
            resp_detail_r = await client.get(target_r_url)
            print("Rakuma Detail Status:", resp_detail_r.status_code)
            cond_r, ship_r = parse_rakuma_html(resp_detail_r.text)
            print(f"Rakuma Parsed -> Condition: '{cond_r}', Shipping: '{ship_r}'")

if __name__ == "__main__":
    asyncio.run(test_enrich())
