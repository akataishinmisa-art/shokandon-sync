const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/item/m62808756184';
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const html = await page.content();

    const itemIdMatch = url.match(/item\/(m\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : '';

    console.log('Item ID:', itemId);
    const matches = html.match(new RegExp(`https?:\\\\?\\/\\\\?\\/[^"'\\s]+${itemId}[^"'\\s]+`, 'g'));
    console.log('Matched item photos:');
    console.log(matches ? [...new Set(matches.map(m => m.replace(/\\/g, '')))] : 'None');

    await browser.close();
})();
