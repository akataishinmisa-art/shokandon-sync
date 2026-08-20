import asyncio
import sys
sys.path.insert(0, "backend")
from shipping_parser import fetch_exact_shipping_detail
import httpx
from bs4 import BeautifulSoup
import re

async def main():
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0, follow_redirects=True) as client:
        # ヤフオク
        print("Testing Yahoo Auction...")
        r_y = await client.get("https://auctions.yahoo.co.jp/search/search?p=Canon+PowerShot+S110&va=Canon+PowerShot+S110&s1=new&o1=d&n=5")
        s_y = BeautifulSoup(r_y.text, "html.parser")
        y_link = s_y.find("a", class_=re.compile(r"Product__titleLink|Product__title"))
        if y_link:
            y_url = y_link["href"]
            if y_url.startswith("//"): y_url = "https:" + y_url
            y_ship = await fetch_exact_shipping_detail(y_url, "ヤフオク")
            print("Yahoo Auction shipping:", y_ship)

        # ラクマ
        print("Testing Rakuma...")
        r_r = await client.get("https://fril.jp/s?query=PowerShot+S110&transaction=selling")
        s_r = BeautifulSoup(r_r.text, "html.parser")
        r_link = s_r.find("a", href=re.compile(r"item.fril.jp"))
        if r_link:
            r_ship = await fetch_exact_shipping_detail(r_link["href"], "ラクマ")
            print("Rakuma shipping:", r_ship)

asyncio.run(main())
