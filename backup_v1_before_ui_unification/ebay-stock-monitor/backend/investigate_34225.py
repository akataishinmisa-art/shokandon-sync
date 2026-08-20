import asyncio
import os
import sys
import urllib.parse
from playwright.async_api import async_playwright

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_mercari(keyword, sort_mode):
    encoded_kw = urllib.parse.quote(keyword)
    sort_param = "sort=created_time&order=desc" if sort_mode == "recent" else "sort=price&order=desc"
    url = f"https://jp.mercari.com/search?keyword={encoded_kw}&status=on_sale&{sort_param}"
    print(f"\n--- Mercari URL ({sort_mode}): {url} ---")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=USER_AGENT)
        page = await context.new_page()
        
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        try:
            await page.wait_for_selector("li[data-testid='item-cell']", timeout=8000)
        except Exception:
            pass

        items_raw = await page.eval_on_selector_all("li[data-testid='item-cell']", """elements => {
            return elements.map(el => {
                const a = el.querySelector('a');
                const img = el.querySelector('img');
                return {
                    url: a ? a.href : '',
                    title: (a && a.getAttribute('aria-label')) ? a.getAttribute('aria-label').replace('のサムネイル', '').trim() : (img ? img.alt.replace('のサムネイル', '').trim() : ''),
                    image_url: img ? img.src : '',
                    raw_text: el.innerText
                };
            });
        }""")
        await browser.close()

        print(f"Total raw items on page: {len(items_raw)}")
        found_target = False
        for it in items_raw:
            raw = it.get("raw_text", "").replace("\n", " ")
            url_item = it.get("url", "")
            title = it.get("title", "")
            print(f"Item: {raw[:60]} | URL: {url_item}")
            if "34,225" in raw or "34225" in raw or "34225" in url_item:
                print(f"  >>> FOUND 34,225 ITEM! Title: {title}")
                found_target = True

        if not found_target:
            print("  >>> 34,225 item NOT on this first page.")

if __name__ == "__main__":
    print("Testing recent mode:")
    asyncio.run(test_mercari("EX-ZR1800", "recent"))
    print("\nTesting all mode:")
    asyncio.run(test_mercari("EX-ZR1800", "all"))
