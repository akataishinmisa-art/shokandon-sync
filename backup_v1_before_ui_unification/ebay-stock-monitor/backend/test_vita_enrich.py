import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine

async def test_vita():
    init_db()
    target = get_target_item(4)
    items = await monitor_engine.check_single_item(target, search_mode="all", ignore_max_price=True)
    
    with open("vita_check_results.txt", "w", encoding="utf-8") as out:
        out.write(f"Total confirmed items: {len(items)}\n")
        for it in items[:15]:
            out.write(f"[{it['platform']}] ¥{it['price_jpy']} | 🏷️ {it.get('condition')} | 🚚 {it.get('shipping_days')} | {it['title'][:30]}\n")

if __name__ == "__main__":
    asyncio.run(test_vita())
