const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    let executablePath = '/usr/bin/google-chrome';
    if (!fs.existsSync(executablePath)) executablePath = '/usr/bin/chromium';

    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const url = 'https://jp.mercari.com/item/m81167409683';
    console.log('Row 3 opening:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const info = await page.evaluate(() => {
        const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
        const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');

        return {
            docTitle: document.title,
            titleEl: titleEl ? titleEl.textContent.trim() : '',
            ogTitle: ogTitle ? ogTitle.getAttribute('content') : '',
            metaPrice: metaPrice ? metaPrice.getAttribute('content') : '',
            priceEl: priceEl ? priceEl.textContent.trim() : ''
        };
    });

    console.log('Row 3 Info:', JSON.stringify(info, null, 2));
    await browser.close();
})();
