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

        # ページ内のアイテムメタデータ
        items_data = await page.evaluate("""() => {
            const cells = document.querySelectorAll("li[data-testid='item-cell']");
            return Array.from(cells).map(cell => {
                const a = cell.querySelector('a');
                const img = cell.querySelector('img');
                const text = cell.innerText || '';
                return {
                    href: a ? a.href : '',
                    alt: img ? img.alt : '',
                    text: text
                };
            });
        }""")

        for it in items_data[:10]:
            href = it['href']
            alt = it['alt']
            # メルカリの各商品リンクから個別にPlaywrightでページを開くのではなく、
            # メルカリの公開API (https://api.mercari.jp/items/get?id=m...) を叩けるかテスト
            item_id = href.split('/')[-1] if href else ''
            print(f"ID: {item_id}")

        await browser.close()

asyncio.run(test_playwright_mercari_shipping())
