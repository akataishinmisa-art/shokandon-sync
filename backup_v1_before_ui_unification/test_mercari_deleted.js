const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function getExecutablePath() {
    if (process.platform === 'linux') {
        return '/usr/bin/chromium';
    }
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

async function testDeletedMercari() {
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = 'https://jp.mercari.com/item/m64420642136';
    console.log(`Navigating to ${url}...`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    const result = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const titleEl = document.querySelector('h1') || document.querySelector('[data-testid="item-name"]');
        const title = titleEl ? titleEl.textContent.trim() : document.title;
        const isDeleted = bodyText.includes('該当する商品は削除されています') ||
                          bodyText.includes('この商品は削除されました') ||
                                  bodyText.includes('削除された商品') ||
                          bodyText.includes('商品が見つかりません');
        return {
            title,
            docTitle: document.title,
            isDeleted,
            bodySnippet: bodyText.substring(0, 300)
        };
    });

    console.log('Result:', result);
    await browser.close();
}

testDeletedMercari();
