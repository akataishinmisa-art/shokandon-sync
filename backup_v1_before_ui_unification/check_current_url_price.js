const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

async function checkPrice(url) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

        const html = await page.content();

        // Check title
        const title = await page.evaluate(() => document.title);

        // Check price from RSC or DOM
        const rscPrice = html.match(/\\*"price\\*":\s*([0-9]{3,8})/i) ||
                         html.match(/\\"price\\":\s*([0-9]{3,8})/i) ||
                         html.match(/price\\":\s*([0-9]{3,8})/i);

        let price = rscPrice ? `￥${parseInt(rscPrice[1]).toLocaleString()}` : '';

        if (!price) {
            price = await page.evaluate(() => {
                const el = document.querySelector('[data-testid="price"], .merItemPrice, [class*="price"], .a-price .a-offscreen');
                if (el && el.textContent) {
                    const m = el.textContent.match(/¥\s*([0-9,]+)|￥\s*([0-9,]+)|([0-9,]+)\s*円/);
                    if (m) return `￥${parseInt((m[1]||m[2]||m[3]).replace(/,/g, '')).toLocaleString()}`;
                }
                return '';
            });
        }

        console.log(`URL: ${url}`);
        console.log(`Title: ${title}`);
        console.log(`Price: ${price}`);
    } catch(e) {
        console.error('Check price error:', e.message);
    } finally {
        if (browser) await browser.close();
    }
}

(async () => {
    await checkPrice('https://jp.mercari.com/item/m73194523883');
})();
