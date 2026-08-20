import asyncio
import os
import sys

# パス設定
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_all_target_items, get_target_item
from monitor_engine import monitor_engine

async def test():
    init_db()
    items = get_all_target_items()
    print(f"Total targets: {len(items)}")
    for item in items:
        print(f"Target ID: {item['id']}, Name: {item['name']}, Keyword: {item['keyword']}, MaxPrice: {item['max_buy_price_jpy']}")
        
    # 最新のターゲットでテスト
    if items:
        target = items[0]
        print(f"\n--- Testing ignore_max_price=True on {target['name']} ---")
        res = await monitor_engine.check_single_item(target, search_mode="recent", ignore_max_price=True)
        print(f"Results count (ignore_max_price=True): {len(res)}")
        for r in res[:10]:
            print(f"  [{r['platform']}] {r['price_jpy']}円: {r['title'][:40]}")

if __name__ == "__main__":
    asyncio.run(test())
