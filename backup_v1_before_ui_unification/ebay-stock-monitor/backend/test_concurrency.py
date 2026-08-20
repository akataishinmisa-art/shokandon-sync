import asyncio
import sys
sys.path.insert(0, "backend")
from detail_enricher import fetch_exact_item_details

# 10件並列で同時にPlaywrightを呼ぶとどうなるかをテスト
test_urls = [
    "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e",
    "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e",
    "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e",
    "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e",
    "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e",
]

async def test_concurrent():
    print(f"Starting {len(test_urls)} concurrent Playwright launches...")
    tasks = [fetch_exact_item_details(u, "メルカリ") for u in test_urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for i, r in enumerate(results):
        print(f"Result {i}: {r}")

asyncio.run(test_concurrent())
