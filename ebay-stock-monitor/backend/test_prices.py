import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine

async def test():
    init_db()
    target = get_target_item(10) or get_target_item(9)
    print(f"Target: {target['name']}, MaxPrice: {target['max_buy_price_jpy']}")
    res = await monitor_engine.check_single_item(target, search_mode="recent", ignore_max_price=True)
    print(f"Total count: {len(res)}")
    for r in res:
        print(f"Price: {r['price_jpy']}, URL: {r['item_url']}")

if __name__ == "__main__":
    asyncio.run(test())
