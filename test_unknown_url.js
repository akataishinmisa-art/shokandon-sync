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

        console.log('Opening eBay Listing Helper http://localhost:8085...');
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2', timeout: 15000 });

        // Enter an unknown product URL
        const testUrl = 'https://www.amazon.co.jp/dp/B001RLZ94S/';
        console.log('Entering URL:', testUrl);

        await page.evaluate((url) => {
            const inputUrl = document.getElementById('input-url');
            inputUrl.value = url;
        }, testUrl);

        console.log('Clicking Auto Parse button...');
        await page.click('#btn-parse-url');

        // Wait 4 seconds for parsing & updating UI
        await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

        console.log('Taking screenshot...');
        await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\unknown_url_fallback_result.png' });
        console.log('Saved unknown_url_fallback_result.png');

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
