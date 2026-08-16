const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    let executablePath = '/usr/bin/google-chrome';
    if (!fs.existsSync(executablePath)) executablePath = '/usr/bin/chromium';

    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const url = 'https://jp.mercari.com/item/m68792414248';
    console.log('Opening:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

    const info = await page.evaluate(() => {
        const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
        const title = titleEl ? titleEl.textContent.trim() : '';

        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]')).map(b => b.textContent.trim());
        const hasSoldoutBtn = buttons.some(txt => txt.includes('売り切れました') || txt.includes('SOLD OUT') || txt.includes('この商品は売り切れました'));

        const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                          document.querySelector('div[aria-label*="売り切れ"]') ||
                          document.querySelector('[class*="sold"]');

        const bodyHasSoldText = document.body.innerText.includes('売り切れました');

        return {
            docTitle: document.title,
            title,
            buttonsCount: buttons.length,
            buttonsMatched: buttons.filter(t => t.includes('売り切れ') || t.includes('購入') || t.includes('SOLD')),
            hasSoldoutBtn,
            hasSoldBadge: Boolean(soldBadge),
            bodyHasSoldText,
            isClosed: Boolean(hasSoldoutBtn || soldBadge || bodyHasSoldText)
        };
    });

    console.log('VPS DEBUG RESULT:', JSON.stringify(info, null, 2));
    await browser.close();
})();
