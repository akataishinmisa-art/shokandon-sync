const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/search?keyword=Panasonic%20LUMIX%20DMC-FX77%20%E3%83%94%E3%83%B3%E3%82%AF';
    console.log('Searching Mercari for LUMIX DMC-FX77...');

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const item = await page.evaluate(() => {
        const link = document.querySelector('a[href*="/item/m"]');
        if (!link) return null;
        const href = link.getAttribute('href');
        const fullUrl = href.startsWith('http') ? href : `https://jp.mercari.com${href}`;
        const priceEl = link.querySelector('[class*="price"], span');
        return {
            url: fullUrl,
            text: link.innerText
        };
    });

    console.log('Found Mercari Item:', item);

    if (item && item.url) {
        await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
        const html = await page.content();
        const rscPrice = html.match(/\\*"price\\*":\s*([0-9]{3,8})/i) ||
                         html.match(/\\"price\\":\s*([0-9]{3,8})/i) ||
                         html.match(/price\\":\s*([0-9]{3,8})/i);
        const title = await page.evaluate(() => document.title);
        console.log('Item Title:', title);
        console.log('Item Price:', rscPrice ? `￥${parseInt(rscPrice[1]).toLocaleString()}` : 'Not found');
    }

    await browser.close();
})();
