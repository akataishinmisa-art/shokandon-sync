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

        await page.evaluate(async () => {
            const inputMpn = document.getElementById('input-mpn');
            inputMpn.value = 'PCH-2000';
            inputMpn.dispatchEvent(new Event('input'));
            inputMpn.dispatchEvent(new Event('change'));
        });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

        console.log('Taking screenshot...');
        await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay_pch2000_updated.png' });
        console.log('Saved ebay_pch2000_updated.png');

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
