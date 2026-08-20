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

        let currentUrl = await page.evaluate(() => {
            const input = document.getElementById('input-url');
            return input ? input.value.trim() : '';
        });

        if (!currentUrl) {
            currentUrl = 'https://store.shopping.yahoo.co.jp/entameoukoku/3226.html';
            await page.evaluate((u) => {
                const input = document.getElementById('input-url');
                if (input) input.value = u;
            }, currentUrl);
        }

        console.log('Target URL:', currentUrl);
        console.log('Triggering Auto Parse button...');
        await page.click('#btn-parse-url');

        // Wait 4 seconds for parsing
        await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

        const extractedValues = await page.evaluate(() => {
            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : '-';
            };
            return {
                url: getVal('input-url'),
                mpn: getVal('input-mpn'),
                price: getVal('input-price'),
                shipping: getVal('input-shipping'),
                fee: getVal('input-fee'),
                exchange: getVal('input-exchange'),
                margin: getVal('input-margin'),
                exportShipping: getVal('input-export-shipping'),
                profit: getVal('input-profit'),
                sellingPrice: getVal('input-selling-price'),
                sellPriceS: getVal('input-sell-price-s'),
                sellPriceA: getVal('input-sell-price-a'),
                sellPriceB: getVal('input-sell-price-b'),
                profitOutput: getVal('db-profit-output')
            };
        });

        console.log('Extracted Values:', JSON.stringify(extractedValues, null, 2));

        await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\active_parse_filled.png' });
        console.log('Saved active_parse_filled.png');

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
