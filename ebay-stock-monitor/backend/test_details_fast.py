import httpx
from bs4 import BeautifulSoup
import re
import asyncio

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_all_details():
    # 1. ヤフオクの実際の商品詳細
    y_url = "https://page.auctions.yahoo.co.jp/jp/auction/1168434863" # または検索から
    # 2. ラクマの実際の商品詳細
    r_url = "https://item.fril.jp/efe246b805098b2357f0931f9043885d"
    # 3. メルカリShopsの実際の商品詳細
    m_url = "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e"

    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=10.0, follow_redirects=True) as client:
        # ラクマ
        r_resp = await client.get(r_url)
        s_r = BeautifulSoup(r_resp.text, "html.parser")
        r_cond, r_ship = "None", "None"
        for tr in s_r.find_all("tr"):
            th = tr.find("th")
            td = tr.find("td")
            if th and td:
                if "商品の状態" in th.text: r_cond = td.text.strip().replace("\n", "")
                if "発送日の目安" in th.text or "発送日" in th.text: r_ship = td.text.strip().replace("\n", "")
        print("Rakuma:", r_cond, "|", r_ship)

asyncio.run(test_all_details())
