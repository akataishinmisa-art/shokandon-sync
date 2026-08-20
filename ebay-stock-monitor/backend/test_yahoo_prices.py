import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import urllib.parse

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_yahoo_prices():
    kw = "PlayStation Vita PCH-2000"
    encoded_kw = urllib.parse.quote(kw)
    url = f"https://auctions.yahoo.co.jp/search/search?p={encoded_kw}&va={encoded_kw}&is_postage_mode=1&dest_pref_code=13&exflg=1&b=1&n=20&s1=new&o1=d"
    
    with open("yahoo_prices_debug.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "html.parser")
            items = soup.find_all("li", class_=re.compile(r"Product"))
            out.write(f"Total products found: {len(items)}\n")
            for it in items:
                title_a = it.find("a", class_=re.compile(r"Product__titleLink|Product__title"))
                if not title_a:
                    continue
                title = title_a.text.strip()
                href = title_a.get("href", "")
                
                # 全ての価格要素を探す
                price_blocks = it.find_all(class_=re.compile(r"Product__price|Price"))
                out.write(f"\nTitle: {title[:40]} | URL: {href}\n")
                
                buynow_price = None
                current_price = None
                
                # 即決価格
                buynow_el = it.find(class_=re.compile(r"buynow|Product__price--buynow|Price__value--buynow"))
                if buynow_el:
                    m = re.search(r'[\d,]+', buynow_el.text)
                    if m:
                        buynow_price = int(m.group(0).replace(',', ''))
                
                # 通常価格
                price_el = it.find(class_=re.compile(r"Product__priceValue|Price__value"))
                if price_el:
                    m = re.search(r'[\d,]+', price_el.text)
                    if m:
                        current_price = int(m.group(0).replace(',', ''))
                
                out.write(f"  Current Price: {current_price} | Buynow Price: {buynow_price} | InnerText: {it.text.replace(chr(10), ' ')[:100]}\n")

if __name__ == "__main__":
    asyncio.run(test_yahoo_prices())
