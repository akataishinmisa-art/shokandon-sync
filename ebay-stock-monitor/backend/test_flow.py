import asyncio
import sys
sys.path.insert(0, "backend")
from monitor_engine import monitor_engine
from database import get_all_target_items, get_recent_detections

async def test_full_flow():
    items = get_all_target_items()
    target = items[0]
    print(f"Target: {target['name']}")
    
    # チェック実行
    res = await monitor_engine.check_single_item(target)
    print(f"Returned {len(res)} items immediately.")
    
    # バックグラウンド処理が完了するまで待機（15秒）
    print("Waiting 15 seconds for background enrichment...")
    await asyncio.sleep(15)
    
    # DBの最新状態を確認
    db_items = get_recent_detections(limit=10)
    for it in db_items[:5]:
        c = it.get("condition", "")
        s = it.get("shipping_days", "")
        safe_c = c.encode('ascii', errors='replace').decode('ascii')
        safe_s = s.encode('ascii', errors='replace').decode('ascii')
        print(f"ID {it['id']} | [{it['platform']}] {it['title'][:20]} | Cond: {safe_c} | Ship: {safe_s}")

asyncio.run(test_full_flow())
