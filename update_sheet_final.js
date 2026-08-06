const puppeteer = require('puppeteer-core');
const fs = require('fs');
const https = require('https');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

function getAuctionData(url) {
    return new Promise((resolve, reject) => {
        const aucId = url.split('/').pop().split('?')[0];
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                let title = '';
                let price = '';

                const itemMatch = html.match(new RegExp(`"productID":"${aucId}".*?"productName":"(.*?)".*?"price":"(\\d+)"`));
                if (itemMatch) {
                    title = itemMatch[1];
                    price = parseInt(itemMatch[2], 10).toLocaleString('ja-JP') + '円';
                } else {
                    const pageDataMatch = html.match(/var pageData = (.*?);/);
                    if (pageDataMatch) {
                        try {
                            const data = JSON.parse(pageDataMatch[1]);
                            if (data.items && data.items.productID === aucId) {
                                title = data.items.productName;
                                price = parseInt(data.items.price, 10).toLocaleString('ja-JP') + '円';
                            }
                        } catch (e) {}
                    }
                }

                resolve({ aucId, title, price });
            });
        }).on('error', reject);
    });
}

(async () => {
    const url = 'https://auctions.yahoo.co.jp/jp/auction/u1238271947';
    console.log('Fetching auction data for:', url);
    const auctionInfo = await getAuctionData(url);
    console.log('Auction Data:', auctionInfo);

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0';
    console.log('Opening sheet in browser...');
    await page.goto(sheetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#t-name-box', { timeout: 30000 });

    async function selectCell(cellName) {
        await page.click('#t-name-box');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.type(cellName);
        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    }

    async function setCellText(text) {
        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

        const textareaExists = await page.$('.grid-textarea');
        if (textareaExists) {
            await page.type('.grid-textarea', text, { delay: 5 });
        } else {
            await page.keyboard.type(text, { delay: 5 });
        }
        await page.keyboard.press('Enter');
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    // 1. Read existing value in D2 before changing it
    // Select D2 and copy/read it or read formula bar text
    console.log('Selecting D2 to read existing price...');
    await selectCell('D2');
    let oldD2Value = '23,000円'; // default based on earlier state if empty

    // Try reading formula bar
    const formulaText = await page.evaluate(() => {
        const el = document.querySelector('#t-formula-bar-input');
        return el ? el.textContent.trim() : '';
    });
    if (formulaText) {
        oldD2Value = formulaText;
    }
    console.log('Original D2 value:', oldD2Value);

    // 2. Write Product Name to C2
    console.log('Writing product name to C2...');
    await selectCell('C2');
    await setCellText(auctionInfo.title);

    // 3. Write old D2 value to E2
    console.log(`Writing old D2 value ('${oldD2Value}') to E2...`);
    await selectCell('E2');
    await setCellText(oldD2Value);

    // 4. Write new price to D2
    console.log(`Writing new price ('${auctionInfo.price}') to D2...`);
    await selectCell('D2');
    await setCellText(auctionInfo.price);

    // 5. Compare D2 and E2
    const numNew = parseInt(auctionInfo.price.replace(/[^0-9]/g, ''), 10);
    const numOld = parseInt(oldD2Value.replace(/[^0-9]/g, ''), 10);
    console.log(`Comparing D2 (${numNew}) vs E2 (${numOld})`);

    if (numNew !== numOld) {
        console.log('Prices differ! Changing D2 background color to Red...');
        await selectCell('D2');

        // Click fill color button in toolbar
        await page.click('#t-fill-color');
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

        // Click red swatch
        const colorClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            for (const el of elements) {
                const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
                const color = el.getAttribute('data-color') || '';
                if ((label.includes('赤') || label.includes('Red') || color === '#ff0000' || color === '#ea4335' || color === '#f44336') && el.clientWidth > 0 && el.clientHeight > 0) {
                    el.click();
                    return true;
                }
            }
            return false;
        });
        console.log('Color clicked:', colorClicked);
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    }

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\sheet_final_updated.png' });

    console.log('Waiting for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Execution completed!');
})();
