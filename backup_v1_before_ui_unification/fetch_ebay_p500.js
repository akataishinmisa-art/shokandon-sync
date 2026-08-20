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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log('Fetching eBay sold items for Nikon COOLPIX P500...');
        await page.goto('https://www.ebay.com/sch/i.html?_nkw=Nikon+COOLPIX+P500&LH_Sold=1&LH_Complete=1', { waitUntil: 'domcontentloaded', timeout: 30000 });

        await page.waitForSelector('.s-item', { timeout: 10000 });

        const items = await page.evaluate(() => {
            const list = [];
            const elements = document.querySelectorAll('.s-item');
            elements.forEach(el => {
                const titleEl = el.querySelector('.s-item__title');
                const priceEl = el.querySelector('.s-item__price');
                const dateEl = el.querySelector('.s-item__title--tagblock .POSITIVE, .s-item__caption--top');
                if (titleEl && priceEl) {
                    const title = titleEl.innerText.trim();
                    const price = priceEl.innerText.trim();
                    if (!title.includes('Shop on eBay') && price) {
                        list.push({ title, price });
                    }
                }
            });
            return list;
        });

        console.log('Found Sold Items:', JSON.stringify(items.slice(0, 15), null, 2));

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
