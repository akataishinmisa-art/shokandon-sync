import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from scraper import ScraperManager

async def test_all_kw():
    init_db()
    target = get_target_item(11)
    kw = target["keyword"]
    print(f"Target 11 Keyword: '{kw}'")
    
    # 1. メルカリ
    m = await ScraperManager.search_mercari_playwright(kw, search_mode="all")
    print(f"Mercari: {len(m)}")
    
    # 2. Yahoo!フリマ
    yf = await ScraperManager.search_yahoo_fleamarket(kw, search_mode="all")
    print(f"Yahoo Fleamarket: {len(yf)}")
    
    # 3. ヤフオク
    ya = await ScraperManager.search_yahoo_auction(kw, search_mode="all")
    print(f"Yahoo Auction: {len(ya)}")
    
    # 4. ラクマ
    r = await ScraperManager.search_rakuma(kw, search_mode="all")
    print(f"Rakuma: {len(r)}")

if __name__ == "__main__":
    asyncio.run(test_all_kw())
