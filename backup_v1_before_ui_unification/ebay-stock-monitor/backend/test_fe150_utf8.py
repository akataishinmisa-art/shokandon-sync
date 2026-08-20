import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine

async def test():
    init_db()
    target = get_target_item(11)
    items = await monitor_engine.check_single_item(target, search_mode="all", ignore_max_price=True)
    
    with open("fe150_check_results.txt", "w", encoding="utf-8") as out:
        out.write(f"Total confirmed items: {len(items)}\n")
        for it in items:
            is_match = "4900" in str(it["price_jpy"]) or "充電器セット" in it["title"]
            mark = ">>> [HIT!]" if is_match else "   "
            out.write(f"{mark} [{it['platform']}] ¥{it['price_jpy']}: {it['title']}\n")

if __name__ == "__main__":
    asyncio.run(test())
