import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item, get_all_target_items
from monitor_engine import monitor_engine

async def trace_check():
    init_db()
    targets = get_all_target_items()
    
    with open("trace_check_all.txt", "w", encoding="utf-8") as out:
        for t in targets[:4]:
            out.write(f"\n========================================\n")
            out.write(f"Target ID {t['id']}: {t['name']}\n")
            out.write(f"Keyword: '{t['keyword']}', Excludes: '{t.get('exclude_keywords', '')}', MaxPrice: {t.get('max_buy_price_jpy')}\n")
            out.write(f"========================================\n")
            
            items = await monitor_engine.check_single_item(t, search_mode="all", ignore_max_price=True)
            
            platform_counts = {}
            for it in items:
                p = it.get("platform", "不明")
                platform_counts[p] = platform_counts.get(p, 0) + 1
                
            out.write(f"Total Confirmed: {len(items)}\n")
            out.write(f"Platform Breakdown: {platform_counts}\n")
            for p, c in platform_counts.items():
                sample = next((it for it in items if it["platform"] == p), None)
                if sample:
                    out.write(f"  [{p} Sample] ¥{sample['price_jpy']} | {sample['title'][:40]}\n")

if __name__ == "__main__":
    asyncio.run(trace_check())
