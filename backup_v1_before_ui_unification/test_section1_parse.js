const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 960 });

        console.log('Navigating to http://localhost:8085...');
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2', timeout: 15000 });

        // Enter URL for Nikon 1 J5 or PS Vita
        const testUrl = 'https://store.shopping.yahoo.co.jp/excellar/1350013328.html';
        console.log('Setting input-url:', testUrl);

        await page.evaluate((url) => {
            const inputUrl = document.getElementById('input-url');
            inputUrl.value = url;
        }, testUrl);

        console.log('Triggering auto parse...');
        await page.click('#btn-parse-url');

        // Wait 4 seconds for parsing & UI updates
        await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

        const resultState = await page.evaluate(() => {
            return {
                url: document.getElementById('input-url')?.value,
                mpn: document.getElementById('input-mpn')?.value,
                price: document.getElementById('input-price')?.value,
                shipping: document.getElementById('input-shipping')?.value,
                sellPriceS: document.getElementById('input-sell-price-s')?.value,
                sellPriceA: document.getElementById('input-sell-price-a')?.value,
                sellPriceB: document.getElementById('input-sell-price-b')?.value,
                sellingPrice: document.getElementById('input-selling-price')?.value,
                profit: document.getElementById('input-profit')?.value,
                descDetails: document.getElementById('input-desc-details')?.value
            };
        });

        console.log('\n===== Section 1 Result State =====');
        console.log(JSON.stringify(resultState, null, 2));

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
