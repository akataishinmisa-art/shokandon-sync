import asyncio
from playwright.async_api import async_playwright
import re

async def debug_shops_shipping():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # メルカリ検索
        await page.goto("https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale", wait_until="domcontentloaded")
        await page.wait_for_selector("li[data-testid='item-cell']", timeout=8000)
        
        # リンク取得
        links = await page.eval_on_selector_all("li[data-testid='item-cell'] a", "elements => elements.map(a => a.href)")
        
        target_url = None
        for href in links:
            if "mercari-shops.com" in href:
                target_url = href
                break
        if not target_url and links:
            target_url = links[0]
            
        print("Target URL found. Navigating...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=12000)
        await page.wait_for_timeout(2500)
        
        # テキスト取得
        body_text = await page.inner_text("body")
        lines = [line.strip() for line in body_text.split('\n') if "発送" in line]
        for line in lines:
            safe_line = line.encode('ascii', errors='replace').decode('ascii')
            print("Found shipping text line:", safe_line)
            
        # DOMから発送までの日数の次の要素
        shipping_val = await page.evaluate("""() => {
            const allElements = document.querySelectorAll('*');
            for (let el of allElements) {
                if (el.children.length === 0 && el.innerText && el.innerText.includes('発送までの日数')) {
                    const next = el.nextElementSibling || el.parentElement.nextElementSibling;
                    if (next) return next.innerText;
                }
            }
            return null;
        }""")
        print("DOM evaluation shipping value:", shipping_val)

        await browser.close()

asyncio.run(debug_shops_shipping())
