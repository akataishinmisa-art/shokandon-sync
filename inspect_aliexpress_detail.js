const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://ja.aliexpress.com/item/1005010369091586.html?sourceType=562&pvid=f893ded7-5484-402d-a4e3-edc13ba3cc2f&pdp_ext_f=%7B%22ship_from%22%3A%22CN%22%2C%22sku_id%22%3A%2212000052160646579%22%7D&scm=1007.28480.422277.0&scm-';

    console.log('Fetching detailed AliExpress product DOM...');
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
        await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

        const details = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent.trim() || '';

            // Color / SKU options
            const skuEls = Array.from(document.querySelectorAll('[class*="sku-item"], [class*="sku-attr-val"] img, [class*="sku"] img'));
            const skuList = skuEls.map(img => img.getAttribute('title') || img.getAttribute('alt') || '').filter(Boolean);

            // Shipping info
            const shipEls = Array.from(document.querySelectorAll('[class*="shipping"], [class*="delivery"]'));
            const shipTexts = shipEls.map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 200);

            // Seller info
            const sellerEl = document.querySelector('[class*="seller"]');
            const seller = sellerEl ? sellerEl.textContent.trim() : '';

            // Store rating
            const ratingEl = document.querySelector('[class*="rating"], [class*="score"]');
            const rating = ratingEl ? ratingEl.textContent.trim() : '';

            return { title, skuList, shipTexts: shipTexts.slice(0, 5), seller, rating };
        });

        console.log('Detailed Info:', JSON.stringify(details, null, 2));

        await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\antigravity\\scratch\\aliexpress_detail.png' });
    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
})();
