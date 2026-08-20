import asyncio
from playwright.async_api import async_playwright
import urllib.parse

async def test_mercari_title_extraction():
    url = "https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale&sort=created_time&order=desc"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_selector("li[data-testid='item-cell']", timeout=6000)
        
        items_debug = await page.eval_on_selector_all("li[data-testid='item-cell']", """elements => {
            return elements.map(el => {
                const a = el.querySelector('a');
                const img = el.querySelector('img');
                return {
                    href: a ? (a.href || '') : '',
                    ariaLabel: a ? (a.getAttribute('aria-label') || '') : '',
                    imgAlt: img ? (img.alt || '') : '',
                    text: el.innerText || ''
                };
            });
        }""")
        
        print(f"Total elements: {len(items_debug)}")
        found = 0
        for it in items_debug:
            label = it['ariaLabel'] or it['imgAlt'] or ''
            href = it['href']
            # 安全に出力
            safe_label = label[:40].encode('ascii', errors='replace').decode('ascii')
            if "30,000" in it['text'] or "006900" in label or "mercari-shops" in href:
                found += 1
                print(f"Found Item #{found}: href={href} | label={safe_label}")

        await browser.close()

asyncio.run(test_mercari_title_extraction())
