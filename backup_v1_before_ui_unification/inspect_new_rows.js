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

    async function getCellUrl(cellName) {
        await selectCell(cellName);
        let formulaText = await page.evaluate(() => {
            const el = document.querySelector('#t-formula-bar-input');
            return el ? el.textContent.trim() : '';
        });

        if (!formulaText) return '';
        if (formulaText.startsWith('http')) return formulaText;

        await page.keyboard.down('Control');
        await page.keyboard.press('K');
        await page.keyboard.up('Control');
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

        const linkUrl = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            for (const input of inputs) {
                if (input.value && input.value.startsWith('http')) {
                    return input.value;
                }
            }
            const anchors = Array.from(document.querySelectorAll('a[href*="http"]'));
            for (const a of anchors) {
                if (a.href && a.href.startsWith('http') && !a.href.includes('docs.google.com')) {
                    return a.href;
                }
            }
            return '';
        });

        await page.keyboard.press('Escape');
        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

        return linkUrl;
    }

    const rows = [];
    for (let r = 2; r <= 10; r++) {
        const url = await getCellUrl(`B${r}`);
        if (!url) {
            console.log(`Row ${r} B is empty.`);
            break;
        }
        rows.push({ row: r, url });
    }

    console.log('Detected URLs in Sheet:', rows);
    await browser.close();
})();
