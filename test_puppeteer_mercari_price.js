const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/item/m73194523883';
    console.log('Testing Puppeteer Mercari Price for:', url);

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

    const price = await page.evaluate(() => {
        // 1. Selector data-testid="price" or merItemPrice
        const el = document.querySelector('[data-testid="price"]') ||
                   document.querySelector('div[class*="price"]') ||
                   document.querySelector('span[class*="price"]');

        if (el) {
            const txt = el.innerText || el.textContent || '';
            const m = txt.match(/¥\s*([0-9,]+)|￥\s*([0-9,]+)|([0-9,]+)\s*円/);
            if (m) {
                const num = (m[1] || m[2] || m[3]).replace(/,/g, '');
                return `￥${parseInt(num).toLocaleString()}`;
            }
        }

        // 2. Search entire body text for price pattern
        const bodyTxt = document.body.innerText || '';
        const mBody = bodyTxt.match(/¥\s*([0-9,]{3,9})/);
        if (mBody && mBody[1]) {
            return `￥${parseInt(mBody[1].replace(/,/g, '')).toLocaleString()}`;
        }

        return '';
    });

    console.log('Extracted Mercari Price:', price);
    await browser.close();
})();
