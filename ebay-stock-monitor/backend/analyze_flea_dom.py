import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def analyze_flea_dom():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://paypayfleamarket.yahoo.co.jp/search/PS%20Vita?open=1&sort=-openTime", timeout=15000)
        await page.wait_for_timeout(2000)
        content = await page.content()
        soup = BeautifulSoup(content, "html.parser")
        
        # すべてのscriptタグのidやtypeを確認
        scripts = soup.find_all("script")
        print(f"Total script tags: {len(scripts)}")
        for s in scripts:
            if s.get("id") or s.get("type") == "application/json":
                print("  Script:", s.get("id"), s.get("type"), len(s.string or ""))
                
        # 商品カードaタグの中身を確認
        items = soup.find_all("a", href=lambda h: h and "/item/" in h)
        print(f"Found item links: {len(items)}")
        if items:
            print("First item inner text:", items[0].get_text(separator=" | ", strip=True))
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(analyze_flea_dom())
