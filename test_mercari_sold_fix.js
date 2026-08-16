const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const url = 'https://jp.mercari.com/item/m68792414248';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    const result = await page.evaluate(() => {
        const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
        const title = titleEl ? titleEl.textContent.trim() : '';

        // メルカリの売り切れ判定ロジック（広範・高精度判定）
        const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        const hasSoldoutBtn = allButtons.some(b => {
            const txt = (b.textContent || '').trim();
            return txt.includes('売り切れました') || txt.includes('SOLD OUT') || txt.includes('この商品は売り切れました');
        });

        const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                          document.querySelector('div[aria-label*="売り切れ"]') ||
                          document.querySelector('[class*="sold"]');

        const bodyHasSoldText = document.body.innerText.includes('売り切れました');

        const isClosed = Boolean(hasSoldoutBtn || soldBadge || bodyHasSoldText);

        return {
            title,
            hasSoldoutBtn,
            hasSoldBadge: Boolean(soldBadge),
            bodyHasSoldText,
            isClosed
        };
    });

    console.log('Test Result for m68792414248:', JSON.stringify(result, null, 2));

    await browser.close();
})();
