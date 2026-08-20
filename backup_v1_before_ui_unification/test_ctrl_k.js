const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0';
    await page.goto(sheetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#t-name-box', { timeout: 30000 });

    async function selectCell(cellName) {
        await page.click('#t-name-box');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type(cellName);
        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    console.log('Selecting B3...');
    await selectCell('B3');

    // Press Ctrl+K
    console.log('Pressing Ctrl+K...');
    await page.keyboard.down('Control');
    await page.keyboard.press('K');
    await page.keyboard.up('Control');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    // Read link input or popup DOM
    const linkUrl = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const input of inputs) {
            if (input.value && input.value.startsWith('http')) {
                return input.value;
            }
        }
        const anchors = Array.from(document.querySelectorAll('a[href*="http"]'));
        for (const a of anchors) {
            if (a.href.includes('auctions.yahoo.co.jp') || a.href.includes('jp/auction')) {
                return a.href;
            }
        }
        return '';
    });

    console.log('Link URL found via Ctrl+K:', linkUrl);

    await page.keyboard.press('Escape');
    await browser.close();
})();
