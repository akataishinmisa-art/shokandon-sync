import asyncio
import os
import sys
import urllib.parse
from playwright.async_api import async_playwright

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_mercari_default(keyword):
    encoded_kw = urllib.parse.quote(keyword)
    # おすすめ順（デフォルトソート）
    url = f"https://jp.mercari.com/search?keyword={encoded_kw}&status=on_sale"
    print(f"URL: {url}")

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

        with open("mercari_default_sort.txt", "w", encoding="utf-8") as f:
            f.write(f"Total raw items on page: {len(items_raw)}\n")
            for it in items_raw:
                raw = it.get("raw_text", "").replace("\n", " ")
                url_item = it.get("url", "")
                f.write(f"Item: {raw} | URL: {url_item}\n")
                if "34,225" in raw or "34225" in raw:
                    f.write(f"  >>> FOUND 34,225 ITEM! Title: {it.get('title')}\n")

if __name__ == "__main__":
    asyncio.run(test_mercari_default("CASIO EX-ZR1800"))
