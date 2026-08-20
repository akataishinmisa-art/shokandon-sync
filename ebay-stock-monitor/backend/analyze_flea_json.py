import asyncio
from playwright.async_api import async_playwright
import json
from bs4 import BeautifulSoup

async def analyze_flea():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # Yahooフリマの検索ページ
        await page.goto("https://paypayfleamarket.yahoo.co.jp/search/PS%20Vita?open=1&sort=-openTime", timeout=15000)
        await page.wait_for_timeout(2000)
        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")
        
        # __NEXT_DATA__
        next_script = soup.find("script", id="__NEXT_DATA__")
        if next_script:
            data = json.loads(next_script.string)
            with open("flea_next_data_structure.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("Successfully saved flea_next_data_structure.json")
        else:
            print("No __NEXT_DATA__ script found")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(analyze_flea())
