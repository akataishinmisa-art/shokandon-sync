const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/item/m73194523883';
    console.log('Debugging Mercari price for:', url);

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const html = await page.content();
    fs.writeFileSync('mercari_debug.html', html, 'utf8');

    const result = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('*'));
        const priceEls = els.filter(el => el.children.length === 0 && (el.textContent.includes('¥') || el.textContent.includes('￥') || el.textContent.includes('円')));
        return priceEls.slice(0, 15).map(e => ({ tag: e.tagName, text: e.textContent, class: e.className }));
    });

    console.log('Mercari price elements found:', JSON.stringify(result, null, 2));

    await browser.close();
})();
