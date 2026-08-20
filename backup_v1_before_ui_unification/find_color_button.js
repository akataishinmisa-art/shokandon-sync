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

    const buttons = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('*'));
        return els
            .filter(el => {
                const label = el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.title || '';
                const id = el.id || '';
                return label.includes('塗りつぶし') || label.includes('Fill') || id.includes('fill') || id.includes('color');
            })
            .map(el => ({
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                ariaLabel: el.getAttribute('aria-label'),
                dataTooltip: el.getAttribute('data-tooltip'),
                title: el.title
            }));
    });

    console.log('Found toolbar buttons:', buttons);
    await browser.close();
})();
