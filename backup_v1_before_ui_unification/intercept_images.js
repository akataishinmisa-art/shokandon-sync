const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/item/m62808756184';
    console.log('Intercepting image requests for:', url);

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    const loadedImages = [];

    page.on('response', async (res) => {
        const reqUrl = res.url();
        if (reqUrl.includes('mercdn') || reqUrl.includes('photos') || reqUrl.includes('item')) {
            if (res.status() === 200 && res.headers()['content-type']?.includes('image')) {
                loadedImages.push(reqUrl);
            }
        }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    console.log('Successfully intercepted 200 OK image URLs:');
    console.log(loadedImages);

    await browser.close();
})();
