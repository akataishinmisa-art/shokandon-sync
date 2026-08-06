const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/item/m94329477079';

    console.log('Testing Mercari SOLD OUT detection for m94329477079...');
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

        const info = await page.evaluate(() => {
            const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
            const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - メルカリ', '');

            const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
            let price = priceEl ? priceEl.textContent.trim() : '';

            // Detect SOLD OUT
            const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                              document.querySelector('div[aria-label*="売り切れ"]') ||
                              document.querySelector('[class*="soldOutRef"]');
            const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
            const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';

            const isClosed = Boolean(soldBadge || (checkoutBtn && checkoutBtn.disabled && btnText.includes('売り切れ')));

            const statusText = isClosed ? '欠品 (SOLD OUT)' : '販売中';

            return { title, price, isClosed, statusText, hasSoldBadge: Boolean(soldBadge), btnText };
        });

        console.log('Test Result:', JSON.stringify(info, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
})();
