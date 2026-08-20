import asyncio
from playwright.async_api import async_playwright
import re

async def test_mercari_shops_shipping():
    # メルカリShopsの個別ページテスト
    url = "https://mercari-shops.com/products/4d6W7Ckgwz7U5dYgq48tL8" # または検索で引っかかったメルカリURL
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # メルカリ検索ページを開く
        await page.goto("https://jp.mercari.com/search?keyword=Canon%20PowerShot%20S110&status=on_sale", wait_until="domcontentloaded")
        await page.wait_for_selector("li[data-testid='item-cell']", timeout=6000)
        
        # 最初のメルカリ商品のリンクを取得
        first_item = await page.eval_on_selector("li[data-testid='item-cell'] a", "a => a.href")
        print("First item URL:", first_item)
        
        # その個別ページへ遷移
        await page.goto(first_item, wait_until="domcontentloaded", timeout=10000)
        await page.wait_for_timeout(2000) # DOMレンダリング待機
        
        content = await page.content()
        m = re.search(r'発送までの日数.*?([1１][~〜～\-ー][2２]日で発送|[2２][~〜～\-ー][3３]日で発送|[4４][~〜～\-ー][7７]日で発送|即日|24時間)', content, re.DOTALL)
        if m:
            print("Successfully extracted Mercari shipping:", m.group(1))
        else:
            # ページ内のテキストを検索
            body_text = await page.inner_text("body")
            m2 = re.search(r'発送までの日数[^\n]*\n*([^\n]+)', body_text)
            if m2:
                print("Extracted from inner_text:", m2.group(1))
            else:
                print("Could not find shipping in text")
                
        await browser.close()

asyncio.run(test_mercari_shops_shipping())
