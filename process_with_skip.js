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
                let isClosed = false;

                const pageDataMatch = html.match(/var pageData = (.*?);/);
                if (pageDataMatch) {
                    try {
                        const data = JSON.parse(pageDataMatch[1]);
                        if (data.items) {
                            title = data.items.productName || '';
                            price = parseInt(data.items.price, 10).toLocaleString('ja-JP') + '円';
                            isClosed = (data.items.isClosed === '1' || data.items.hasWinner === '1');
                        }
                    } catch (e) {}
                }

                if (!title) {
                    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
                    title = titleMatch ? titleMatch[1].replace(' - Yahoo!オークション', '').replace(' - ヤフオク!', '').trim() : '';
                }

                if (html.includes('このオークションは終了しています') || html.includes('オークション終了')) {
                    isClosed = true;
                }

                const statusText = isClosed ? '欠品' : '販売中';
                resolve({ aucId, title, price, isClosed, statusText });
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
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
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

    async function getCellUrl(cellName) {
        await selectCell(cellName);
        let formulaText = await page.evaluate(() => {
            const el = document.querySelector('#t-formula-bar-input');
            return el ? el.textContent.trim() : '';
        });

        if (!formulaText) return '';
        if (formulaText.startsWith('http')) return formulaText;

        await page.keyboard.down('Control');
        await page.keyboard.press('K');
        await page.keyboard.up('Control');
        await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

        const linkUrl = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            for (const input of inputs) {
                if (input.value && input.value.startsWith('http')) {
                    return input.value;
                }
            }
            const anchors = Array.from(document.querySelectorAll('a[href*="http"]'));
            for (const a of anchors) {
                if (a.href.includes('auctions.yahoo.co.jp') || a.href.includes('jp/auction')) {
                    return a.href;
                }
            }
            return '';
        });

        await page.keyboard.press('Escape');
        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

        return linkUrl;
    }

    async function setCellRedBackground(cellName) {
        await selectCell(cellName);
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

        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
        await page.keyboard.press('Escape');
        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    }

    const parseNum = (val) => {
        if (!val) return null;
        const cleaned = val.replace(/[^0-9]/g, '');
        return cleaned ? parseInt(cleaned, 10) : null;
    };

    for (let r = 2; r < 100; r++) {
        console.log(`\n================ Processing Row ${r} ================`);
        const targetUrl = await getCellUrl(`B${r}`);
        if (!targetUrl) {
            console.log(`Row ${r} B has no URL. Reached end of data.`);
            break;
        }
        console.log(`Row ${r} URL:`, targetUrl);

        // Fetch auction data
        const auctionData = await getAuctionData(targetUrl);
        console.log(`Row ${r} Auction Data:`, auctionData);

        // Overwrite C{r} with Product Name
        console.log(`Overwriting C${r} with Product Name...`);
        await selectCell(`C${r}`);
        await overwriteCellText(auctionData.title);

        // Overwrite F{r} with Status (販売中 or 欠品)
        console.log(`Overwriting F${r} with Status ('${auctionData.statusText}')...`);
        await selectCell(`F${r}`);
        await overwriteCellText(auctionData.statusText);

        // CHECK IF 欠品 (SOLDOUT/Closed)
        if (auctionData.statusText === '欠品') {
            console.log(`Row ${r} is 欠品 (SOLDOUT). Skipping price updates and moving to next row.`);
            continue;
        }

        // If 販売中 (Active), proceed with price updates
        // Read current D{r} value before modifying
        await selectCell(`D${r}`);
        const oldDValue = await page.evaluate(() => {
            const el = document.querySelector('#t-formula-bar-input');
            return el ? el.textContent.trim() : '';
        });
        console.log(`Row ${r} Current D value:`, oldDValue);

        // Overwrite E{r} with old D value
        console.log(`Overwriting E${r} with Old D Value ('${oldDValue}')...`);
        await selectCell(`E${r}`);
        await overwriteCellText(oldDValue);

        // Overwrite D{r} with New Price
        console.log(`Overwriting D${r} with New Price ('${auctionData.price}')...`);
        await selectCell(`D${r}`);
        await overwriteCellText(auctionData.price);

        // Compare D{r} and E{r} numeric values
        const numD = parseNum(auctionData.price);
        const numE = parseNum(oldDValue);
        console.log(`Row ${r} Compare D (${numD}) vs E (${numE})`);

        if (numD !== numE) {
            console.log(`Row ${r}: Prices differ! Highlighting D${r} in RED...`);
            await setCellRedBackground(`D${r}`);
        } else {
            console.log(`Row ${r}: Prices match.`);
        }
    }

    console.log('\nTaking final screenshot...');
    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\skip_soldout_result.png' });

    console.log('Waiting for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Process with skip completed successfully!');
})();
