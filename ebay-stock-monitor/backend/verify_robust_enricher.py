import asyncio
import sys
sys.path.insert(0, "backend")
from detail_enricher_robust import enrich_all_items_robust

test_items = [
    {
        "title": "C (一部難あり) Canon キヤノン PowerShot S110 シルバー 返品不可 66-219",
        "item_url": "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e",
        "platform": "メルカリ",
        "price_jpy": 24800,
        "condition": "出品ページ参照",
        "shipping_days": "出品ページ参照"
    }
]

async def main():
    res = await enrich_all_items_robust(test_items)
    for r in res:
        safe_c = r['condition'].encode('ascii', errors='replace').decode('ascii')
        safe_s = r['shipping_days'].encode('ascii', errors='replace').decode('ascii')
        print(f"Condition: {safe_c} | Shipping: {safe_s}")

asyncio.run(main())
