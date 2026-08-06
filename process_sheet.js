const puppeteer = require('puppeteer-core');
const fs = require('fs');
const https = require('https');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

function fetchUrlContent(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchUrlContent(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function parseYahooAuction(html) {
    let productName = '';
    let price = '';

    const pageDataMatch = html.match(/var pageData = ({.*?});/s);
    if (pageDataMatch) {
        try {
            const pageData = JSON.parse(pageDataMatch[1]);
            if (pageData.items) {
                productName = pageData.items.productName || '';
                price = pageData.items.price || '';
            }
        } catch (e) {}
    }

    if (!productName) {
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) {
            productName = titleMatch[1].replace(' - Yahoo!オークション', '').replace(' - ヤフオク!', '').trim();
        }
    }

    if (price && !price.includes('円')) {
        const num = parseInt(price, 10);
        if (!isNaN(num)) {
            price = num.toLocaleString('ja-JP') + '円';
        }
    }

    return { productName, price };
}

(async () => {
    console.log('Fetching sheet CSV to find rows...');
    const csvData = await fetchUrlContent('https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/export?format=csv&gid=0');
    console.log('CSV Data:\n', csvData);

    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
        console.log('No data rows found.');
        return;
    }

    const rowsToProcess = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        const rowNum = i + 1;
        const url = cols[1] || ''; // B列
        const oldD = cols[3] || ''; // D列

        if (url && url.startsWith('http')) {
            rowsToProcess.push({
                rowNum,
                url,
                oldD
            });
        }
    }

    console.log('Rows to process:', rowsToProcess);

    for (const r of rowsToProcess) {
        console.log(`Fetching details for row ${r.rowNum}: ${r.url}`);
        try {
            const html = await fetchUrlContent(r.url);
            const { productName, price } = parseYahooAuction(html);
            r.newProductName = productName;
            r.newPrice = price;
            console.log(`Row ${r.rowNum} parsed:`, { productName, price });
        } catch (e) {
            console.error(`Error fetching URL for row ${r.rowNum}:`, e.message);
        }
    }

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

    async function setCellBackgroundRed() {
        console.log('Setting background color to Red...');
        const selectors = [
            '#t-fill-color',
            'div[aria-label*="塗りつぶし"]',
            'div[data-tooltip*="塗りつぶし"]',
            'div[aria-label*="Fill color"]',
            'div[data-tooltip*="Fill color"]'
        ];

        let clicked = false;
        for (const s of selectors) {
            const btn = await page.$(s);
            if (btn) {
                await btn.click();
                clicked = true;
                break;
            }
        }

        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

        const colorClicked = await page.evaluate(() => {
            const swatches = Array.from(document.querySelectorAll('.docs-material-colorpalette-colorswatch, [aria-label*="赤"], [title*="赤"], [data-color="#ff0000"], [data-color="#f44336"], [data-color="#ea4335"]'));
            for (const el of swatches) {
                const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
                const color = el.getAttribute('data-color') || '';
                if (label.includes('赤') || color === '#ff0000' || color === '#ea4335' || color === '#f44336') {
                    el.click();
                    return true;
                }
            }
            return false;
        });

        console.log('Color clicked result:', colorClicked);
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    }

    for (const r of rowsToProcess) {
        const row = r.rowNum;
        console.log(`--- Processing Row ${row} ---`);

        // 1. Write product name to C{row}
        if (r.newProductName) {
            console.log(`Writing product name to C${row}...`);
            await selectCell(`C${row}`);
            await setCellText(r.newProductName);
        }

        // 2. Copy old D{row} value to E{row}
        console.log(`Copying old D value ('${r.oldD}') to E${row}...`);
        await selectCell(`E${row}`);
        await setCellText(r.oldD);

        // 3. Write new price to D{row}
        if (r.newPrice) {
            console.log(`Writing new price ('${r.newPrice}') to D${row}...`);
            await selectCell(`D${row}`);
            await setCellText(r.newPrice);
        }

        // 4. Compare D and E values (numerically)
        const parseNum = (val) => {
            if (!val) return null;
            const cleaned = val.replace(/[^0-9]/g, '');
            return cleaned ? parseInt(cleaned, 10) : null;
        };

        const numD = parseNum(r.newPrice);
        const numE = parseNum(r.oldD);

        console.log(`Comparing D${row} (${numD}) and E${row} (${numE})...`);
        const isDifferent = (numD !== numE);

        if (isDifferent) {
            console.log(`Values are different! Highlighting D${row} red...`);
            await selectCell(`D${row}`);
            await setCellBackgroundRed();
        } else {
            console.log('Values are identical.');
        }
    }

    console.log('Taking final screenshot...');
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\final_sheet_result.png' });

    console.log('Waiting 5s for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('All updates completed!');
})();
