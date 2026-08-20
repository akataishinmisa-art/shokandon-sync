const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://www.amazon.co.jp/%E3%82%B3%E3%83%B3%E3%83%90%E3%83%BC%E3%82%B9-%E3%82%B9%E3%83%8B%E3%83%BC%E3%82%AB%E3%83%BC-NEXTAR-110-HI/dp/B07SW2ZCRF/';

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigating to Amazon URL...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const prices = await page.evaluate(() => {
        const results = [];
        const selectors = [
            '#corePrice_desktop',
            '#corePrice_feature_div',
            '#corePriceDisplay_desktop_feature_div',
            '.apexPriceToPay',
            '.priceToPay',
            '#price_inside_buybox',
            '#priceblock_ourprice',
            '#price',
            '.a-price',
            'span.a-color-price'
        ];

        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            els.forEach(e => {
                const text = e.textContent.trim().replace(/\s+/g, ' ');
                if (text) results.push({ selector: sel, text });
            });
        }
        return results;
    });

    console.log('Price elements found:', JSON.stringify(prices, null, 2));

    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\amazon_page.png' });
    await browser.close();
})();
