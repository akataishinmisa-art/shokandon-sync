const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://www.ebay.com/itm/168566857553';

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigating to eBay URL...');
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const info = await page.evaluate(() => {
            const titleEl = document.querySelector('h1.x-item-title__mainTitle') || document.querySelector('h1');
            const title = titleEl ? titleEl.textContent.trim() : document.title;

            const msgEl = document.querySelector('.x-item-notice') || document.querySelector('.d-status-message');
            const msg = msgEl ? msgEl.textContent.trim() : '';

            return { title, msg };
        });
        console.log('eBay Item Details:', JSON.stringify(info, null, 2));
    } catch (e) {
        console.error('Error fetching eBay:', e);
    }

    await browser.close();
})();
