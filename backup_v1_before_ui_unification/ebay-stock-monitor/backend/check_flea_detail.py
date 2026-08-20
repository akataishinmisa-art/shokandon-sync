import asyncio
import httpx
from bs4 import BeautifulSoup
import re

async def check_flea_html():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    }
    # 実在するYahoo!フリマのURL（先ほどの画像の商品）
    # タイトル: 美品 SONY PS Vita PCH-2000 ピンク×ブラック 画面線あり
    # 検索からURLを取得
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        # ヤフオクとYahooフリマのPlaywright取得テスト
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto("https://paypayfleamarket.yahoo.co.jp/search/PS%20Vita%20PCH-2000?open=1&sort=-openTime", timeout=15000)
            await page.wait_for_timeout(2000)
            
            links = await page.eval_on_selector_all("a[href*='/item/']", "elements => elements.map(e => e.href)")
            print("Found Flea URLs via browser:", len(links))
            if links:
                first_url = links[0]
                print("First Flea URL:", first_url)
                await page.goto(first_url, timeout=15000)
                await page.wait_for_timeout(2000)
                content = await page.content()
                with open("flea_item_detail.html", "w", encoding="utf-8") as f:
                    f.write(content)
                print("Saved flea_item_detail.html")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(check_flea_html())
