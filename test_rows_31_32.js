const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });

    const urls = [
        { row: 31, url: 'https://jp.mercari.com/item/m68792414248' },
        { row: 32, url: 'https://jp.mercari.com/item/m76271738019' }
    ];

    for (const item of urls) {
        const page = await browser.newPage();
        await page.goto(item.url, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

        const data = await page.evaluate(() => {
            const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
            const title = titleEl ? titleEl.textContent.trim() : '';

            const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
            const price = priceEl ? priceEl.textContent.trim() : '';

            const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') || document.querySelector('div[aria-label*="売り切れ"]');
            const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
            const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';
            const btnDisabled = checkoutBtn ? checkoutBtn.disabled : false;

            const isSold = Boolean(soldBadge || (checkoutBtn && checkoutBtn.disabled && (btnText.includes('売り切れ') || btnText.includes('SOLD OUT'))));

            return {
                title,
                price,
                hasSoldBadge: Boolean(soldBadge),
                btnText,
                btnDisabled,
                isSold
            };
        });

        console.log(`Row ${item.row} (${item.url}):`, JSON.stringify(data, null, 2));
        await page.close();
    }

    await browser.close();
})();
