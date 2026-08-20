import asyncio
from playwright.async_api import async_playwright
import urllib.parse
import re

async def test_mercari_playwright():
    kw = "Canon PowerShot S110"
    encoded_kw = urllib.parse.quote(kw)
    url = f"https://jp.mercari.com/search?keyword={encoded_kw}&status=on_sale"
    
    print("Launching Chromium...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded")
        
        # アイテムセルが表示されるのを待機
        try:
            await page.wait_for_selector("li[data-testid='item-cell']", timeout=8000)
        except:
            print("Timeout waiting for item-cell, evaluating DOM...")

        # 商品カードを抽出
        items = await page.eval_on_selector_all("li[data-testid='item-cell']", """elements => {
            return elements.map(el => {
                const a = el.querySelector('a');
                const img = el.querySelector('img');
                const priceMatch = el.textContent.match(/([0-9,]+)\\s*円/);
                const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
                return {
                    url: a ? a.href : '',
                    title: img ? img.alt : '',
                    image_url: img ? img.src : '',
                    price: price
                };
            });
        }""")

        print(f"Found {len(items)} items on Mercari via Playwright!")
        for it in items[:10]:
            print(f"[{it['price']}円] {it['title']} -> {it['url']}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_mercari_playwright())
