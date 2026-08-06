const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0';
    await page.goto(sheetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#t-name-box', { timeout: 30000 });

    const productName = 'SONY ソニー ゲーム機本体 PSP本体 PSP-3000 / PSP-1000 / 計7台 まとめ売り 動作未確認 ジャンク #03102';
    const price = '23,000円';

    console.log('Navigating to B2 via Name Box...');
    await page.click('#t-name-box');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.type('B2');
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    console.log('Editing B2...');
    // In Google Sheets, pressing Enter on selected cell opens edit mode
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    // Copy product name to clipboard and paste via Ctrl+V or evaluate
    // Let's set clipboard in browser
    await page.evaluate((text) => {
        navigator.clipboard.writeText(text);
    }, productName).catch(() => {});

    // Type text into active cell input
    // Google Sheets active cell input element has class 'grid-textarea' or contenteditable
    const textareaExists = await page.$('.grid-textarea');
    if (textareaExists) {
        console.log('Found .grid-textarea, typing into it...');
        await page.type('.grid-textarea', productName, { delay: 5 });
    } else {
        console.log('Typing via keyboard...');
        await page.keyboard.type(productName, { delay: 5 });
    }

    // Press Tab to commit B2 and move directly to C2
    console.log('Pressing Tab to move to C2...');
    await page.keyboard.press('Tab');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    console.log('Editing C2...');
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    const textareaExistsC = await page.$('.grid-textarea');
    if (textareaExistsC) {
        await page.type('.grid-textarea', price, { delay: 5 });
    } else {
        await page.keyboard.type(price, { delay: 5 });
    }

    // Press Enter to commit C2
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

    // Take screenshot for debugging
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\sheet_result.png' });
    console.log('Saved screenshot to sheet_result.png');

    console.log('Waiting 5s for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Finished script execution.');
})();
