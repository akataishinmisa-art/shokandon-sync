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

    async function getCellValue(cellName) {
        await page.click('#t-name-box');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type(cellName);
        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));

        return await page.evaluate(() => {
            const el = document.querySelector('#t-formula-bar-input');
            return el ? el.textContent.trim() : '';
        });
    }

    const rowData = [];
    for (let r = 2; r <= 10; r++) {
        const valB = await getCellValue(`B${r}`);
        const valD = await getCellValue(`D${r}`);
        if (!valB) {
            console.log(`Row ${r} B is empty. Stopping scan.`);
            break;
        }
        rowData.push({ row: r, B: valB, D: valD });
    }

    console.log('Inspected Rows:', rowData);
    await browser.close();
})();
