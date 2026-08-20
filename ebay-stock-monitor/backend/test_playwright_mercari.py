import asyncio
from playwright.async_api import async_playwright
import urllib.parse
import json

async def test_playwright_mercari_shipping():
    keyword = "Canon PowerShot S110"
    encoded_kw = urllib.parse.quote(keyword)
    url = f"https://jp.mercari.com/search?keyword={encoded_kw}&status=on_sale&sort=created_time&order=desc"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_selector("li[data-testid='item-cell']", timeout=6000)

        # ページ内の Next.js データを抽出
        next_data = await page.evaluate("""() => {
            const el = document.getElementById('__NEXT_DATA__');
            if (el) {
                try {
                    return JSON.parse(el.innerText);
                } catch(e) { return null; }
            }
            return null;
        }""")

        # カードDOMのテキストと属性
        cards = await page.eval_on_selector_all("li[data-testid='item-cell']", """elements => {
            return elements.map(el => {
                return {
                    text: el.innerText,
                    html: el.innerHTML
                };
            });
        }""")

        print(f"Cards count: {len(cards)}")
        if cards:
            for c in cards[:3]:
                print("Card text:", c['text'].replace('\n', ' | '))

        if next_data:
            print("Next.js data found! Keys:", list(next_data.keys()))
            props = next_data.get("props", {}).get("pageProps", {})
            print("pageProps keys:", list(props.keys()))

        await browser.close()

asyncio.run(test_playwright_mercari_shipping())
