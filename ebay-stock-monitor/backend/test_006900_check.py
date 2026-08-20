import asyncio
import sys
sys.path.insert(0, "backend")
from scraper import ScraperManager
from monitor_engine import monitor_engine
from database import get_all_target_items

async def check_006900():
    target = get_all_target_items()[0]
    keyword = target["keyword"]
    max_price = float(target["max_buy_price_jpy"])
    min_price = max_price * 0.20
    
    # メルカリから生のアイテムを取得
    items = await ScraperManager.search_mercari_playwright(keyword, max_price=max_price, min_price=min_price, search_mode="all")
    
    print(f"Total raw items from Mercari: {len(items)}")
    for it in items:
        p = int(it['price_jpy'])
        t = it['title']
        u = it['item_url']
        safe_t = t[:40].encode('ascii', errors='replace').decode('ascii')
        print(f"Price: {p} | Title: {safe_t} | URL: {u}")
        if "006900" in t or "2JL6E8QyouGBuXQfpeK7cR" in u:
            print("  >>> THIS IS THE 006900 ITEM <<<")

asyncio.run(check_006900())
