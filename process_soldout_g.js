const puppeteer = require('puppeteer-core');
const fs = require('fs');
const https = require('https');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchHtml(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function getYahooItemData(url) {
    const html = await fetchHtml(url);
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
    return { title, price, isClosed, statusText };
}

async function getItemDataPuppeteer(browser, url) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

        const info = await page.evaluate((targetUrl) => {
            let title = '';
            let price = '';
            let isClosed = false;

            if (targetUrl.includes('amazon.co.jp')) {
                const titleEl = document.querySelector('#productTitle') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title;

                const priceEl = document.querySelector('.priceToPay') ||
                                document.querySelector('#corePrice_feature_div .a-price .a-offscreen') ||
                                document.querySelector('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen') ||
                                document.querySelector('.a-price .a-offscreen');
                price = priceEl ? priceEl.textContent.trim() : '';
                if (price && !price.includes('円') && price.includes('￥')) {
                    price = price.replace('￥', '') + '円';
                }

                const availabilityEl = document.querySelector('#availability');
                const availText = availabilityEl ? availabilityEl.textContent.trim() : '';
                isClosed = availText.includes('一時的に在庫切れ') || availText.includes('現在お取り扱いしておりません') || availText.includes('在庫切れ');
            } else if (targetUrl.includes('aliexpress.com')) {
                const titleEl = document.querySelector('h1[data-pl="product-title"]') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title;

                const priceEl = document.querySelector('.product-price-current') || document.querySelector('.price-default') || document.querySelector('[class*="price"]');
                let rawPrice = priceEl ? priceEl.textContent.trim() : '';
                if (rawPrice.includes('円')) {
                    const priceMatch = rawPrice.match(/([0-9,]+円)/);
                    price = priceMatch ? priceMatch[1] : rawPrice;
                } else {
                    price = rawPrice;
                }

                const mainArea = document.querySelector('#root') || document.body;
                const mainText = mainArea ? mainArea.textContent : '';
                isClosed = mainText.includes('Page Not Found') || mainText.includes('Sorry, this item is no longer available');
            } else if (targetUrl.includes('mercari.com')) {
                const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - メルカリ', '');

                const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
                let rawPrice = priceEl ? priceEl.textContent.trim() : '';
                if (rawPrice.startsWith('¥')) {
                    price = rawPrice.replace('¥', '') + '円';
                } else {
                    price = rawPrice;
                }

                const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                                  document.querySelector('div[aria-label*="売り切れ"]');
                const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
                const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';

                isClosed = Boolean(soldBadge || (checkoutBtn && checkoutBtn.disabled && btnText.includes('売り切れ')));
            }

            const statusText = isClosed ? '欠品' : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        await page.close();
        return info;
    } catch (e) {
        await page.close();
        console.error('Puppeteer error for', url, e.message);
        return { title: '取得エラー', price: '', isClosed: false, statusText: '販売中' };
    }
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
                if (a.href && a.href.startsWith('http') && !a.href.includes('docs.google.com')) {
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

        await page.evaluate(() => {
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

        let itemData;
        if (targetUrl.includes('auctions.yahoo.co.jp')) {
            itemData = await getYahooItemData(targetUrl);
        } else {
            itemData = await getItemDataPuppeteer(browser, targetUrl);
        }
        console.log(`Row ${r} Item Data:`, itemData);

        // CHECK IF 欠品 (SOLDOUT/Closed)
        if (itemData.statusText === '欠品') {
            console.log(`Row ${r} is 欠品 (SOLDOUT). Writing '欠品' into C${r}, E${r}, F${r}, and '出品取り消し' into G${r}.`);
            await selectCell(`C${r}`);
            await overwriteCellText('欠品');

            await selectCell(`E${r}`);
            await overwriteCellText('欠品');

            await selectCell(`F${r}`);
            await overwriteCellText('欠品');

            await selectCell(`G${r}`);
            await overwriteCellText('出品取り消し');
            continue;
        }

        // If 販売中 (Active):
        console.log(`Row ${r} is 販売中. Writing product name to C${r}...`);
        await selectCell(`C${r}`);
        await overwriteCellText(itemData.title);

        console.log(`Writing status '販売中' to F${r}...`);
        await selectCell(`F${r}`);
        await overwriteCellText('販売中');

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
        if (itemData.price) {
            console.log(`Overwriting D${r} with New Price ('${itemData.price}')...`);
            await selectCell(`D${r}`);
            await overwriteCellText(itemData.price);
        }

        // Compare D{r} and E{r} numeric values
        const numD = parseNum(itemData.price || oldDValue);
        const numE = parseNum(oldDValue);
        console.log(`Row ${r} Compare D (${numD}) vs E (${numE})`);

        if (numD !== numE && numE !== null) {
            console.log(`Row ${r}: Prices differ! Highlighting D${r} in RED...`);
            await setCellRedBackground(`D${r}`);
        } else {
            console.log(`Row ${r}: Prices match or initial setup.`);
        }
    }

    console.log('Waiting for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Process Soldout G mode completed successfully!');
})();
