import asyncio
import sys
sys.path.insert(0, "backend")
from detail_enricher import fetch_exact_item_details

async def test_enricher():
    url = "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e"
    cond, ship = await fetch_exact_item_details(url, "メルカリ")
    print("Fetched Condition:", cond.encode('ascii', errors='replace').decode('ascii'))
    print("Fetched Shipping:", ship.encode('ascii', errors='replace').decode('ascii'))

asyncio.run(test_enricher())
