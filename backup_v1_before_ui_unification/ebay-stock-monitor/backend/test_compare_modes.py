import asyncio
from playwright.async_api import async_playwright
import urllib.parse

async def compare_mercari_modes():
    kw = "Canon PowerShot S110"
    enc = urllib.parse.quote(kw)
    
    # 1. 価格の安い順 (全体)
    url_price_asc = f"https://jp.mercari.com/search?keyword={enc}&status=on_sale&sort=price&order=asc&price_min=6092&price_max=30462"
    # 2. 新着順 (直近)
    url_recent = f"https://jp.mercari.com/search?keyword={enc}&status=on_sale&sort=created_time&order=desc&price_min=6092&price_max=30462"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # 価格安い順
        p1 = await browser.new_page()
        await p1.goto(url_price_asc, wait_until="domcontentloaded")
        await p1.wait_for_selector("li[data-testid='item-cell']", timeout=6000)
        items_asc = await p1.eval_on_selector_all("li[data-testid='item-cell']", "els => els.map(e => e.innerText.replace(/\\n/g, ' | '))")
        
        print(f"=== [全体: 価格安い順] 上位10件 (取得総数 {len(items_asc)}件) ===")
        for i, it in enumerate(items_asc[:10]):
            safe = it.encode('ascii', errors='replace').decode('ascii')
            print(f"#{i+1}: {safe}")
            
        print("\n30,000円の商品は含まれているか？")
        found_30k = any("30,000" in it for it in items_asc)
        print(f"Found 30,000 yen in asc search: {found_30k}")

        await browser.close()

asyncio.run(compare_mercari_modes())
