import asyncio
import sys
sys.path.insert(0, "backend")
from monitor_engine import monitor_engine
from database import get_all_target_items, get_recent_detections

async def run_mercari_all():
    target = get_all_target_items()[0]
    print(f"Target: {target['name']}")
    
    # search_mode="all" で実行
    res = await monitor_engine.check_single_item(target, search_mode="all")
    print(f"Result count: {len(res)}")
    for r in res:
        safe_t = r['title'][:35].encode('ascii', errors='replace').decode('ascii')
        print(f"  - [{r['platform']}] {int(r['price_jpy']):,} yen | {safe_t}")

asyncio.run(run_mercari_all())
