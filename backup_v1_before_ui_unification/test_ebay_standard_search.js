const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    const targetUrl = 'https://www.ebay.com/sch/i.html?_nkw=Nikon+COOLPIX+P900';
    console.log('Navigating to:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const title = await page.title();
    console.log('Page Title:', title);

    const prices = await page.evaluate(() => {
        const list = [];
        const els = document.querySelectorAll('.s-item__price');
        els.forEach(el => {
            const text = el.innerText || '';
            const m = text.match(/\$\s*([0-9,.]+)/);
            if (m) {
                const p = parseFloat(m[1].replace(/,/g, ''));
                if (!isNaN(p) && p > 5 && p < 10000) {
                    list.push(p);
                }
            }
        });
        return list;
    });

    console.log('Found Prices:', prices.slice(0, 15));

    await browser.close();
})();
