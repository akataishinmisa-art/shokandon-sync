const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://ja.aliexpress.com/item/1005010369091586.html?sourceType=562&pvid=f893ded7-5484-402d-a4e3-edc13ba3cc2f&pdp_ext_f=%7B%22ship_from%22%3A%22CN%22%2C%22sku_id%22%3A%2212000052160646579%22%7D&scm=1007.28480.422277.0&scm-';

    console.log('Launching browser to check AliExpress item...');
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
            const titleEl = document.querySelector('h1[data-pl="product-title"]') || document.querySelector('h1') || document.querySelector('.product-title-text');
            const title = titleEl ? titleEl.textContent.trim() : document.title;

            // Price selectors
            const priceEl = document.querySelector('.product-price-current') ||
                            document.querySelector('.price-default') ||
                            document.querySelector('[class*="price"]');
            const price = priceEl ? priceEl.textContent.trim() : '';

            const pageText = document.body.textContent || '';
            const isClosed = pageText.includes('利用不可') || pageText.includes('在庫切れ') || pageText.includes('Page Not Found') || pageText.includes('Sorry, this item is no longer available');

            const statusText = isClosed ? '欠品 (SOLDOUT / 利用不可)' : '販売中';

            return { title, price, isClosed, statusText, pageTitle: document.title };
        });

        console.log('AliExpress Item Details:', JSON.stringify(info, null, 2));

        await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\aliexpress_page.png' });
    } catch (e) {
        console.error('Error fetching AliExpress:', e.message);
    }

    await browser.close();
})();
