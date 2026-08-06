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

    // Inspect B2, B3, B4, B5...
    const linksFound = [];
    for (let r = 2; r <= 10; r++) {
        await selectCell(`B${r}`);
        
        // Read text in formula bar
        const formulaText = await page.evaluate(() => {
            const el = document.querySelector('#t-formula-bar-input');
            return el ? el.textContent.trim() : '';
        });

        if (!formulaText) {
            console.log(`Row ${r} formula bar is empty.`);
            break;
        }

        // Check for links on page or hover popups
        const linkHref = await page.evaluate(() => {
            // Check if formula is HYPERLINK("url", "text")
            const formula = document.querySelector('#t-formula-bar-input')?.textContent || '';
            const match = formula.match(/HYPERLINK\("([^"]+)"/i);
            if (match) return match[1];

            // Check links in DOM
            const anchors = Array.from(document.querySelectorAll('a[href*="http"]'));
            for (const a of anchors) {
                if (a.href.includes('auctions.yahoo.co.jp') || a.href.includes('jp/auction')) {
                    return a.href;
                }
            }
            return formula.startsWith('http') ? formula : '';
        });

        linksFound.push({ row: r, text: formulaText, href: linkHref });
    }

    console.log('Links Found:', linksFound);
    await browser.close();
})();
