import asyncio
from playwright.async_api import async_playwright
import json
import re

url = "https://jp.mercari.com/shops/product/2JTgGhjpJuChpv6V8np86e"

async def check_exact_mercari_shops_condition():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
        
        # ページ全体のテキスト
        body_text = await page.inner_text("body")
        
        # 商品の情報セクション
        lines = [l.strip() for l in body_text.split('\n') if l.strip()]
        
        print("=== Mercari Shops Page Content Excerpt ===")
        for i, l in enumerate(lines):
            safe = l.encode('ascii', errors='replace').decode('ascii')
            if "状態" in l or "コンディション" in l or "商品の情報" in l or "傷" in l or "汚れ" in l:
                print(f"Line {i}: {safe}")
                
        # 商品説明全文
        desc = await page.evaluate("""() => {
            const descEl = document.querySelector('[data-testid="description"]') || document.querySelector('section');
            return descEl ? descEl.innerText : document.body.innerText;
        }""")
        
        await browser.close()
        
        # UTF-8でファイルに保存
        with open("backend/mercari_shops_result.txt", "w", encoding="utf-8") as f:
            f.write(body_text)
        print("Full page saved to backend/mercari_shops_result.txt")

asyncio.run(check_exact_mercari_shops_condition())
