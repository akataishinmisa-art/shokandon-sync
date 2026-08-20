import sys
sys.path.insert(0, 'backend')
import asyncio
from monitor_engine import monitor_engine
from database import get_all_target_items

items = get_all_target_items()
item = [i for i in items if 'S110' in i['name']][0]
print(f"Testing check for: {item['name']} | Max price: {item['max_buy_price_jpy']}")

res = asyncio.run(monitor_engine.check_single_item(item))
print(f"Total picked items: {len(res)}")

target_found = [r for r in res if '71645858145' in r['item_url'] or r['price_jpy'] == 30000]
print(f"Target matched items: {len(target_found)}")
for r in target_found:
    print(f"[{r['platform']}] {r['title']} | ¥{r['price_jpy']:,} | URL: {r['item_url']}")
