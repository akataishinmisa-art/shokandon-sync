const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
    console.log('Opening spreadsheet to inspect 商管どん商品DB sheet...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    await page.goto('https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    // Get all tab names
    const tabs = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('.docs-sheet-tab-name'));
        return els.map(el => ({ name: el.textContent.trim(), id: el.closest('.docs-sheet-tab')?.id }));
    });
    console.log('Tabs:', JSON.stringify(tabs, null, 2));

    // Look for tab named '商管どん商品DB'
    const targetTab = tabs.find(t => t.name.includes('商管どん商品DB') || t.name.includes('商品DB') || t.name.includes('DB'));
    if (targetTab) {
        console.log('Target tab found:', targetTab.name);
        await page.evaluate((tName) => {
            const els = Array.from(document.querySelectorAll('.docs-sheet-tab-name'));
            const match = els.find(el => el.textContent.trim() === tName);
            if (match) match.click();
        }, targetTab.name);
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
    }

    // Capture cell values from visible grid
    const cellData = await page.evaluate(() => {
        const input = document.querySelector('#t-formula-bar-input');
        return { formulaBar: input ? input.textContent : '' };
    });
    console.log('Cell Data:', cellData);

    await browser.close();
    process.exit(0);
})();
