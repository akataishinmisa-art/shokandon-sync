import asyncio
import sys
sys.path.insert(0, "backend")
from scraper import ScraperManager
import urllib.parse

async def test_mercari_only_all():
    keyword = "Canon PowerShot S110"
    max_price = 30462.0
    min_price = 6092.0
    
    print(f"Searching Mercari ONLY: keyword='{keyword}', max={max_price}, min={min_price}, mode='all'")
    results = await ScraperManager.search_mercari_playwright(keyword, max_price=max_price, min_price=min_price, search_mode="all")
    
    print(f"\nTotal items fetched from Mercari: {len(results)}")
    for i, r in enumerate(results):
        t = r['title'][:35].encode('ascii', errors='replace').decode('ascii')
        p = int(r['price_jpy'])
        u = r['item_url']
        print(f"#{i+1}: {p:,} yen | {t} | URL: {u}")
        if "006900" in r['title'] or p == 30000:
            print("  ==> [FOUND TARGET 30,000 YEN ITEM!]")

asyncio.run(test_mercari_only_all())
