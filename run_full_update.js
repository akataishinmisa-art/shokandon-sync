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
    console.log('Fetching auction data...');
    const auctionInfo = await getAuctionData(url);
    console.log('Fetched Auction Info:', auctionInfo);

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/edit#gid=0';
    console.log('Opening Google Sheet...');
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

    // 1. Set C2 = Product Name
    console.log('Setting C2 (Product Name)...');
    await selectCell('C2');
    await setCellText(auctionInfo.title);

    // 2. Set E2 = Old Price (23,000円)
    const oldPrice = '23,000円';
    console.log(`Setting E2 (Old Price: ${oldPrice})...`);
    await selectCell('E2');
    await setCellText(oldPrice);

    // 3. Set D2 = New Price (48,398円)
    console.log(`Setting D2 (New Price: ${auctionInfo.price})...`);
    await selectCell('D2');
    await setCellText(auctionInfo.price);

    // 4. Compare D2 (48,398円) vs E2 (23,000円) -> different!
    const numNew = parseInt(auctionInfo.price.replace(/[^0-9]/g, ''), 10);
    const numOld = parseInt(oldPrice.replace(/[^0-9]/g, ''), 10);
    console.log(`Comparing D2 (${numNew}) vs E2 (${numOld})`);

    if (numNew !== numOld) {
        console.log('Prices are different! Setting D2 fill color to RED...');
        await selectCell('D2');
        await page.click('#t-cell-color');
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

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
        console.log('Color swatch click:', clicked);
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    }

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\full_update_done.png' });

    console.log('Waiting 5s for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Full update completed successfully!');
})();
