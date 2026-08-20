import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import ScraperManager
from database import init_db, get_target_item, get_all_target_items

async def full_diagnose():
    init_db()
    targets = get_all_target_items()
    
    with open("full_diagnose_log.txt", "w", encoding="utf-8") as out:
        out.write(f"=== Total targets: {len(targets)} ===\n")
        
        # ターゲット11（OLYMPUS FE-150）とターゲット10（EX-ZR1800）をテスト
        for t in targets[:3]:
            kw = t["keyword"]
            max_p = t["max_buy_price_jpy"]
            out.write(f"\n--- Testing Target ID {t['id']}: {t['name']} (KW: '{kw}', MaxPrice: {max_p}) ---\n")
            
            # 1. メルカリ
            try:
                m_items = await ScraperManager.search_mercari_playwright(kw, max_price=0, min_price=0, search_mode="all")
                out.write(f"  [Mercari] raw count: {len(m_items)}\n")
                if m_items:
                    out.write(f"    sample: {m_items[0]['title'][:30]} | ¥{m_items[0]['price_jpy']}\n")
            except Exception as e:
                out.write(f"  [Mercari ERROR] {e}\n")

            # 2. ラクマ
            try:
                r_items = await ScraperManager.search_rakuma(kw, max_price=0, min_price=0, search_mode="all")
                out.write(f"  [Rakuma] raw count: {len(r_items)}\n")
                if r_items:
                    out.write(f"    sample: {r_items[0]['title'][:30]} | ¥{r_items[0]['price_jpy']}\n")
            except Exception as e:
                out.write(f"  [Rakuma ERROR] {e}\n")

            # 3. ヤフオク
            try:
                ya_items = await ScraperManager.search_yahoo_auction(kw, max_price=0, min_price=0, search_mode="all")
                out.write(f"  [Yahoo Auc] raw count: {len(ya_items)}\n")
                if ya_items:
                    out.write(f"    sample: {ya_items[0]['title'][:30]} | ¥{ya_items[0]['price_jpy']}\n")
            except Exception as e:
                out.write(f"  [Yahoo Auc ERROR] {e}\n")

            # 4. Yahoo!フリマ
            try:
                yf_items = await ScraperManager.search_yahoo_fleamarket(kw, max_price=0, min_price=0, search_mode="all")
                out.write(f"  [Yahoo Flea] raw count: {len(yf_items)}\n")
                if yf_items:
                    out.write(f"    sample: {yf_items[0]['title'][:30]} | ¥{yf_items[0]['price_jpy']}\n")
            except Exception as e:
                out.write(f"  [Yahoo Flea ERROR] {e}\n")

if __name__ == "__main__":
    asyncio.run(full_diagnose())
