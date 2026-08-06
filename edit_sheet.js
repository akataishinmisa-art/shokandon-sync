const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    console.log('Launching browser with:', executablePath);
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0';
    console.log('Navigating to sheet:', sheetUrl);
    await page.goto(sheetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the grid / formula bar to appear
    console.log('Waiting for grid / name box...');
    await page.waitForSelector('#t-name-box', { timeout: 30000 });

    // Step 1: Select B2 via Name Box
    console.log('Selecting B2...');
    await page.click('#t-name-box');
    // Select all and type B2
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type('B2');
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    // Step 2: Set B2 value using formula bar or typing
    console.log('Entering Product Name into B2...');
    const productName = 'SONY ソニー ゲーム機本体 PSP本体 PSP-3000 / PSP-1000 / 計7台 まとめ売り 動作未確認 ジャンク #03102';
    
    // Click formula bar
    await page.click('#t-formula-bar-input');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    // Set text directly or type
    await page.evaluate((text) => {
        const formulaBar = document.querySelector('#t-formula-bar-input');
        if (formulaBar) {
            formulaBar.focus();
        }
    }, productName);
    
    // Use page.keyboard.type or clipboard paste / evaluate
    // For large/Japanese strings, copy to clipboard or insert text in formula bar
    await page.keyboard.type(productName, { delay: 10 });
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

    // Step 3: Select C2 via Name Box
    console.log('Selecting C2...');
    await page.click('#t-name-box');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type('C2');
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    // Step 4: Enter Price into C2
    console.log('Entering Price into C2...');
    const price = '23,000円';
    await page.click('#t-formula-bar-input');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type(price, { delay: 10 });
    await page.keyboard.press('Enter');

    console.log('Waiting for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Done!');
})();
