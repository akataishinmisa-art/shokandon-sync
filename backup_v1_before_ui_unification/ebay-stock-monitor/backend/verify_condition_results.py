import asyncio
import sys
sys.path.insert(0, "backend")
from monitor_engine import monitor_engine
from database import get_all_target_items

async def main():
    items = get_all_target_items()
    if not items:
        print("No items")
        return
    item = items[0]
    print(f"Checking condition for {item['name']}...")
    res = await monitor_engine.check_single_item(item)
    print(f"Total picked items: {len(res)}")
    for r in res[:10]:
        title = r["title"][:22]
        platform = r["platform"]
        price = int(r["price_jpy"])
        cond = r.get("condition", "未取得")
        safe_cond = cond.encode('ascii', errors='replace').decode('ascii')
        print(f"[{platform}] {price:,} yen | Cond: {safe_cond}")

asyncio.run(main())
