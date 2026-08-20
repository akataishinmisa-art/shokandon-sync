import asyncio
from playwright.async_api import async_playwright
import urllib.parse

async def check_mercari_search_order():
    url_created = "https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale&sort=created_time&order=desc"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url_created, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_selector("li[data-testid='item-cell']", timeout=6000)
        
        items = await page.eval_on_selector_all("li[data-testid='item-cell'] a", "elements => elements.map(a => ({href: a.href, text: a.innerText}))")
        
        print(f"Total items fetched from page 1: {len(items)}")
        found_006900 = False
        for it in items:
            if "006900" in it['text'] or "30,000" in it['text']:
                found_006900 = True
                print("Found target 30000 item:", it['text'].replace('\n', ' | '))
                
        if not found_006900:
            print("Target item (006900, 4 months ago) was NOT in page 1 of new listings (created_time desc)!")

        await browser.close()

asyncio.run(check_mercari_search_order())
