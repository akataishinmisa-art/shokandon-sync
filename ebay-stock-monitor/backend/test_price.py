import asyncio
from playwright.async_api import async_playwright
import urllib.parse
import re

async def test_price():
    kw = "Canon PowerShot S110"
    encoded_kw = urllib.parse.quote(kw)
    url = f"https://jp.mercari.com/search?keyword={encoded_kw}&status=on_sale"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_selector("li[data-testid='item-cell']", timeout=10000)

        # 商品カードを抽出
        items = await page.eval_on_selector_all("li[data-testid='item-cell']", """elements => {
            return elements.map(el => {
                const a = el.querySelector('a');
                const img = el.querySelector('img');
                // 価格要素
                const priceEl = el.querySelector("[class*='number'], [class*='price'], span[aria-label*='円']");
                let priceText = priceEl ? priceEl.textContent : el.textContent;
                
                return {
                    url: a ? a.href : '',
                    title: img ? img.alt.replace('のサムネイル', '').trim() : '',
                    image_url: img ? img.src : '',
                    raw_text: el.innerText
                };
            });
        }""")

        for it in items[:10]:
            # 価格抽出 (¥30,000 または 30,000円 または 30000)
            p_match = re.search(r'[¥\￥]?\s*([0-9,]+)', it['raw_text'])
            price = int(p_match.group(1).replace(',', '')) if p_match else 0
            print(f"[{price}円] {it['title']} -> {it['url']}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_price())
