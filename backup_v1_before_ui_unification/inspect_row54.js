const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

function getExecutablePath() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

(async () => {
    const url = 'https://paypayfleamarket.yahoo.co.jp/item/z660121454';
    console.log(`=== 🔍 Inspecting Row 54 URL: ${url} ===`);

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: getExecutablePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    const html = await page.content();
    fs.writeFileSync('row_54_yahooflima.html', html, 'utf8');

    const domInfo = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const titleEl = document.querySelector('h1') || document.querySelector('[class*="ItemTitle_title"]');
        const priceEl = document.querySelector('[class*="ItemPrice"]') || document.querySelector('[class*="Price_value"]');
        const allButtons = Array.from(document.querySelectorAll('button, a')).map(b => b.textContent.trim()).filter(t => t.length > 0);

        return {
            title: titleEl ? titleEl.textContent.trim() : 'NO TITLE',
            price: priceEl ? priceEl.textContent.trim() : 'NO PRICE',
            bodySnippet: bodyText.substring(0, 300),
            buttons: allButtons.slice(0, 15),
            isNotExist: bodyText.includes('この商品は存在しません') || bodyText.includes('公開が停止されました')
        };
    });

    console.log("Row 54 Inspection Result:", domInfo);
    await browser.close();
})();
