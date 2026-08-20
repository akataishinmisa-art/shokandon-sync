import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine
from scraper import ScraperManager

async def test():
    init_db()
    # ターゲット5（Nintendo Switch モンスターハンター）を取得
    target = get_target_item(5)
    print(f"Target: {target['name']}, Keyword: {target['keyword']}, MaxPrice: {target['max_buy_price_jpy']}")

    kw = target["keyword"]
    print("\n--- Testing Scrapers Individually ---")
    
    # 1. メルカリ
    mercari_res = await ScraperManager.search_mercari_playwright(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
    print(f"Mercari: {len(mercari_res)} items")

    # 2. Yahoo!フリマ
    y_flea_res = await ScraperManager.search_yahoo_fleamarket(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
    print(f"Yahoo Fleamarket: {len(y_flea_res)} items")

    # 3. ヤフオク
    y_auc_res = await ScraperManager.search_yahoo_auction(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
    print(f"Yahoo Auction: {len(y_auc_res)} items")

    # 4. ラクマ
    rakuma_res = await ScraperManager.search_rakuma(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
    print(f"Rakuma: {len(rakuma_res)} items")

    print("\n--- Testing Full check_single_item ---")
    res = await monitor_engine.check_single_item(target, search_mode="recent")
    print(f"Total confirmed items: {len(res)}")
    for r in res:
        print(f"  [{r['platform']}] {r['price_jpy']}円: {r['title'][:35]} (is_auction={r.get('is_auction')})")

if __name__ == "__main__":
    asyncio.run(test())
