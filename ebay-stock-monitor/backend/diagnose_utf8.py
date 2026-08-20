import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine
from scraper import ScraperManager

async def test():
    init_db()
    target = get_target_item(5)
    
    with open("diagnose_output.txt", "w", encoding="utf-8") as out:
        out.write(f"Target: {target['name']}, Keyword: {target['keyword']}, MaxPrice: {target['max_buy_price_jpy']}\n")

        kw = target["keyword"]
        out.write("\n--- Testing Scrapers Individually ---\n")
        
        # 1. メルカリ
        try:
            mercari_res = await ScraperManager.search_mercari_playwright(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
            out.write(f"Mercari: {len(mercari_res)} items\n")
            for m in mercari_res[:3]:
                out.write(f"  Mercari sample: {m['title'][:30]} | {m['price_jpy']} | is_auction={m.get('is_auction')}\n")
        except Exception as e:
            out.write(f"Mercari Error: {e}\n")

        # 2. Yahoo!フリマ
        try:
            y_flea_res = await ScraperManager.search_yahoo_fleamarket(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
            out.write(f"Yahoo Fleamarket: {len(y_flea_res)} items\n")
        except Exception as e:
            out.write(f"Yahoo Fleamarket Error: {e}\n")

        # 3. ヤフオク
        try:
            y_auc_res = await ScraperManager.search_yahoo_auction(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
            out.write(f"Yahoo Auction: {len(y_auc_res)} items\n")
            for ya in y_auc_res[:3]:
                out.write(f"  Yahoo Auction sample: {ya['title'][:30]} | {ya['price_jpy']} | is_auction={ya.get('is_auction')}\n")
        except Exception as e:
            out.write(f"Yahoo Auction Error: {e}\n")

        # 4. ラクマ
        try:
            rakuma_res = await ScraperManager.search_rakuma(kw, max_price=target["max_buy_price_jpy"], search_mode="recent")
            out.write(f"Rakuma: {len(rakuma_res)} items\n")
        except Exception as e:
            out.write(f"Rakuma Error: {e}\n")

        out.write("\n--- Testing Full check_single_item ---\n")
        try:
            res = await monitor_engine.check_single_item(target, search_mode="recent")
            out.write(f"Total confirmed items: {len(res)}\n")
            for r in res:
                out.write(f"  [{r['platform']}] {r['price_jpy']}円: {r['title'][:35]} (is_auction={r.get('is_auction')})\n")
        except Exception as e:
            out.write(f"check_single_item Error: {e}\n")

if __name__ == "__main__":
    asyncio.run(test())
