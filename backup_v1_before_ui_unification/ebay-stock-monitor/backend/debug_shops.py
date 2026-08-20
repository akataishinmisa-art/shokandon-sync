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
        
        # 66-219 を含む商品を探す
        links = await page.eval_on_selector_all("li[data-testid='item-cell'] a", "elements => elements.map(a => ({href: a.href, text: a.innerText}))")
        
        target_item = None
        for l in links:
            if "66-219" in l['text'] or "一部難あり" in l['text'] or "mercari-shops" in l['href']:
                target_item = l
                break
                
        if not target_item and links:
            target_item = links[0]
            
        print("Target item link:", target_item)
        
        if target_item:
            url = target_item['href']
            print(f"Navigating to {url}...")
            await page.goto(url, wait_until="domcontentloaded", timeout=12000)
            await page.wait_for_timeout(2000)
            
            content = await page.content()
            body_text = await page.inner_text("body")
            
            print("--- Body text excerpt around '発送' ---")
            lines = [line.strip() for line in body_text.split('\n') if "発送" in line]
            for line in lines:
                print("Line:", line)
                
        await browser.close()

asyncio.run(debug_shops_shipping())
