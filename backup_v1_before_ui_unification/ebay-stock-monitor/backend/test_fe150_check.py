import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine

async def test():
    init_db()
    target = get_target_item(11)
    print(f"Testing target: {target['name']}, keyword: {target['keyword']}")
    items = await monitor_engine.check_single_item(target, search_mode="all", ignore_max_price=True)
    print(f"Total confirmed items: {len(items)}")
    found_target = False
    for it in items:
        if "4900" in str(it["price_jpy"]) or "充電器セット" in it["title"]:
            print(f"  >>> [FOUND TARGET ITEM!] [{it['platform']}] ¥{it['price_jpy']}: {it['title']}")
            found_target = True
        else:
            print(f"  [{it['platform']}] ¥{it['price_jpy']}: {it['title'][:40]}")
    print(f"Target found: {found_target}")

if __name__ == "__main__":
    asyncio.run(test())
