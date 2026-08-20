import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import ScraperManager

async def test_yahoo():
    kw = "OLYMPUS FE-150"
    print(f"=== Testing Yahoo scrapers for keyword: '{kw}' ===")
    
    # 1. ヤフオク
    try:
        ya_res = await ScraperManager.search_yahoo_auction(kw, max_price=0, min_price=0, search_mode="all")
        print(f"Yahoo Auction count: {len(ya_res)}")
        if ya_res:
            print(f"  sample: {ya_res[0]['title'][:40]} | ¥{ya_res[0]['price_jpy']}")
    except Exception as e:
        print(f"Yahoo Auction ERROR: {e}")

    # 2. Yahoo!フリマ
    try:
        yf_res = await ScraperManager.search_yahoo_fleamarket(kw, max_price=0, min_price=0, search_mode="all")
        print(f"Yahoo Fleamarket count: {len(yf_res)}")
        if yf_res:
            print(f"  sample: {yf_res[0]['title'][:40]} | ¥{yf_res[0]['price_jpy']}")
    except Exception as e:
        print(f"Yahoo Fleamarket ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_yahoo())
