import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine

async def test_fast():
    init_db()
    target = get_target_item(11) # OLYMPUS FE-150
    items = await monitor_engine.check_single_item(target, search_mode="all", ignore_max_price=True)
    
    counts = {}
    for it in items:
        p = it["platform"]
        counts[p] = counts.get(p, 0) + 1
    
    with open("fast_test_output.txt", "w", encoding="utf-8") as f:
        f.write(f"Target: {target['name']}\n")
        f.write(f"Total confirmed: {len(items)}\n")
        f.write(f"Platform counts: {counts}\n")
        for p in counts.keys():
            sample = next((it for it in items if it["platform"] == p), None)
            if sample:
                f.write(f"  [{p} Sample] ¥{sample['price_jpy']}: {sample['title'][:40]}\n")

if __name__ == "__main__":
    asyncio.run(test_fast())
