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

        console.log('Connecting to eBay Listing Helper http://localhost:8085...');
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2', timeout: 15000 });

        const state = await page.evaluate(() => {
            const inputUrl = document.getElementById('input-url')?.value || '';
            const inputMpn = document.getElementById('input-mpn')?.value || '';
            const inputPrice = document.getElementById('input-price')?.value || '';
            const inputShipping = document.getElementById('input-shipping')?.value || '';
            const sellPriceS = document.getElementById('input-sell-price-s')?.value || '';
            const sellPriceA = document.getElementById('input-sell-price-a')?.value || '';
            const sellPriceB = document.getElementById('input-sell-price-b')?.value || '';
            const profit = document.getElementById('input-profit')?.value || '';
            const sellingPrice = document.getElementById('input-selling-price')?.value || '';
            const descDetails = document.getElementById('input-desc-details')?.value || '';

            return {
                inputUrl,
                inputMpn,
                inputPrice,
                inputShipping,
                sellPriceS,
                sellPriceA,
                sellPriceB,
                profit,
                sellingPrice,
                descDetails
            };
        });

        console.log('Current UI State:', JSON.stringify(state, null, 2));

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
