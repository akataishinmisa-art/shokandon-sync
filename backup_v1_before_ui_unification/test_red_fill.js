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

    // Select D2
    await page.click('#t-name-box');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type('D2');
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

    console.log('Clicking #t-cell-color...');
    await page.click('#t-cell-color');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    console.log('Looking for red color swatch...');
    const clicked = await page.evaluate(() => {
        const swatches = Array.from(document.querySelectorAll('.docs-material-colorpalette-colorswatch, [aria-label*="赤"], [title*="赤"], [data-color="#f44336"], [data-color="#ff0000"], [data-color="#ea4335"]'));
        for (const s of swatches) {
            const label = s.getAttribute('aria-label') || s.getAttribute('title') || '';
            const color = s.getAttribute('data-color') || '';
            if (label.includes('赤') || color === '#f44336' || color === '#ff0000' || color === '#ea4335') {
                s.click();
                return { success: true, label, color };
            }
        }
        return { success: false };
    });

    console.log('Swatch click result:', clicked);
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\red_fill_test.png' });
    console.log('Saved screenshot red_fill_test.png');

    await browser.close();
})();
