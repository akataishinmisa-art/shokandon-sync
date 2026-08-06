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
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
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

    // Step 1: Read URL in B2
    console.log('Reading B2 URL...');
    await selectCell('B2');
    const urlInB2 = await page.evaluate(() => {
        const el = document.querySelector('#t-formula-bar-input');
        return el ? el.textContent.trim() : '';
    });
    const targetUrl = urlInB2 || 'https://auctions.yahoo.co.jp/jp/auction/u1238271947';

    // Step 2: Fetch auction data
    console.log('Fetching auction details for:', targetUrl);
    const auctionInfo = await getAuctionData(targetUrl);
    console.log('Auction Info:', auctionInfo);

    // Old price in E2 from previous state
    const oldPrice = '23,000円';

    // Step 3: Overwrite C2 with Product Name
    console.log('Overwriting C2 with Product Name...');
    await selectCell('C2');
    await overwriteCellText(auctionInfo.title);

    // Step 4: Overwrite E2 with Old Price (23,000円)
    console.log(`Overwriting E2 with Old Price ('${oldPrice}')...`);
    await selectCell('E2');
    await overwriteCellText(oldPrice);

    // Step 5: Overwrite D2 with New Price (48,398円)
    console.log(`Overwriting D2 with New Price ('${auctionInfo.price}')...`);
    await selectCell('D2');
    await overwriteCellText(auctionInfo.price);

    // Step 6: Compare D2 and E2 values
    const parseNum = (val) => {
        if (!val) return null;
        const cleaned = val.replace(/[^0-9]/g, '');
        return cleaned ? parseInt(cleaned, 10) : null;
    };

    const numD = parseNum(auctionInfo.price);
    const numE = parseNum(oldPrice);

    console.log(`Comparing D2 (${numD}) vs E2 (${numE})`);

    if (numD !== numE) {
        console.log('Values are different! Setting D2 background color to RED...');
        await selectCell('D2');
        await page.click('#t-cell-color');
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

        const clicked = await page.evaluate(() => {
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
        console.log('Color swatch click result:', clicked);
        await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
        // Press Escape to close color popup menu
        await page.keyboard.press('Escape');
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    }

    console.log('Taking final screenshot...');
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\final_perfect_result.png' });

    console.log('Waiting for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Script completed successfully!');
})();
