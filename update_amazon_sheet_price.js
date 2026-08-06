const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0';

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    console.log('Opening sheet...');
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

    async function overwriteCellText(text) {
        await page.keyboard.press('Delete');
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

        const textareaExists = await page.$('.grid-textarea');
        if (textareaExists) {
            await page.type('.grid-textarea', text, { delay: 5 });
        } else {
            await page.keyboard.type(text, { delay: 5 });
        }
        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    async function setCellRedBackground(cellName) {
        await selectCell(cellName);
        await page.click('#t-cell-color');
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

        await page.evaluate(() => {
            const swatches = Array.from(document.querySelectorAll('.docs-material-colorpalette-colorswatch, [aria-label*="赤"], [title*="赤"], [data-color="#f44336"], [data-color="#ff0000"], [data-color="#ea4335"]'));
            for (const s of swatches) {
                const label = s.getAttribute('aria-label') || s.getAttribute('title') || '';
                const color = s.getAttribute('data-color') || '';
                if (label.includes('赤') || color === '#f44336' || color === '#ff0000' || color === '#ea4335') {
                    s.click();
                    return true;
                }
            }
            return false;
        });

        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
        await page.keyboard.press('Escape');
        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    }

    console.log('Updating Row 4 (Amazon) D4 with 3,980円 and setting Old Price E4...');
    await selectCell('D4');
    const oldD4 = await page.evaluate(() => {
        const el = document.querySelector('#t-formula-bar-input');
        return el ? el.textContent.trim() : '';
    });

    await selectCell('E4');
    await overwriteCellText(oldD4);

    await selectCell('D4');
    await overwriteCellText('3,980円');

    if (oldD4 !== '3,980円' && oldD4 !== '3980') {
        console.log('Highlighting D4 in RED...');
        await setCellRedBackground('D4');
    }

    console.log('Taking updated screenshot...');
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\amazon_price_updated.png' });
    await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

    await browser.close();
    console.log('Amazon price update done!');
})();
