const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { processAndDownloadImages } = require('./image_downloader');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
function getExecutablePath() {
    if (process.platform === 'linux') {
        const linuxPaths = [
            process.env.CHROMIUM_PATH,
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable'
        ].filter(Boolean);
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) return p;
        }
        return '/usr/bin/chromium';
    }
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}
const executablePath = getExecutablePath();

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
                price = parseInt(data.items.price, 10).toLocaleString('ja-JP') + '冁E;
                isClosed = (data.items.isClosed === '1' || data.items.hasWinner === '1');
            }
        } catch (e) {}
    }

    if (!title) {
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        title = titleMatch ? titleMatch[1].replace(' - Yahoo!オークション', '').replace(' - ヤフオク!', '').trim() : '';
    }

    if (html.includes('こ�Eオークションは終亁E��てぁE��ぁE) || html.includes('オークション終亁E)) {
        isClosed = true;
    }

    const statusText = isClosed ? '欠品E : '販売中';
    return { title, price, isClosed, statusText, html };
}

async function getItemDataPuppeteer(browser, url) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

        const html = await page.content();
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
                if (price && !price.includes('冁E) && price.includes('�E�')) {
                    price = price.replace('�E�', '') + '冁E;
                }

                const availabilityEl = document.querySelector('#availability');
                const availText = availabilityEl ? availabilityEl.textContent.trim() : '';
                isClosed = availText.includes('一時的に在庫刁E��') || availText.includes('現在お取り扱ぁE��ておりません') || availText.includes('在庫刁E��');
            } else if (targetUrl.includes('aliexpress.com')) {
                const titleEl = document.querySelector('h1[data-pl="product-title"]') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title;

                let currentPriceEl = document.querySelector('[class*="price"][class*="current"]') ||
                                     document.querySelector('[class*="currentPrice"]') ||
                                     document.querySelector('.product-price-current');

                if (!currentPriceEl) {
                    const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
                        const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent.trim() : '';
                        if (!text.includes('冁E) || text.length > 20) return false;

                        const style = window.getComputedStyle(el);
                        const isLineThrough = (style.textDecorationLine || '').includes('line-through') || (style.textDecoration || '').includes('line-through');
                        const isSavings = text.includes('お征E) || text.includes('OFF') || text.includes('引き');

                        return !isLineThrough && !isSavings;
                    });

                    if (candidates.length > 0) {
                        candidates.sort((a, b) => parseFloat(window.getComputedStyle(b).fontSize) - parseFloat(window.getComputedStyle(a).fontSize));
                        currentPriceEl = candidates[0];
                    }
                }

                let rawPrice = currentPriceEl ? currentPriceEl.textContent.trim() : '';
                if (rawPrice.includes('冁E)) {
                    const priceMatch = rawPrice.match(/([0-9,]+冁E/);
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

                const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
                if (metaPrice && metaPrice.getAttribute('content')) {
                    const pVal = parseInt(metaPrice.getAttribute('content'), 10);
                    if (!isNaN(pVal) && pVal > 0) {
                        price = pVal.toLocaleString('ja-JP') + '冁E;
                    }
                }

                if (!price) {
                    const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
                    let rawPrice = priceEl ? priceEl.textContent.trim() : '';
                    const cleanDigits = rawPrice.replace(/[^0-9]/g, '');
                    if (cleanDigits) {
                        price = parseInt(cleanDigits, 10).toLocaleString('ja-JP') + '冁E;
                    }
                }

                const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                                  document.querySelector('div[aria-label*="売り�EめE]');
                const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
                const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';

                isClosed = Boolean(soldBadge || (checkoutBtn && checkoutBtn.disabled && btnText.includes('売り�EめE)));
            } else if (targetUrl.includes('fril.jp') || targetUrl.includes('rakuma')) {
                const titleEl = document.querySelector('.item__name') ||
                                document.querySelector('[class*="item__name"]') ||
                                document.querySelector('.item-header__name') ||
                                document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\s*-\s*ラクチE*/i, '').trim();

                const priceEl = document.querySelector('[itemprop="price"]') ||
                                document.querySelector('.item__price') ||
                                document.querySelector('.item-price') ||
                                document.querySelector('[class*="item__price"]');
                let rawPrice = priceEl ? (priceEl.getAttribute('content') || priceEl.textContent.trim()) : '';
                const cleanNum = rawPrice.replace(/[^0-9]/g, '');
                if (cleanNum) {
                    price = parseInt(cleanNum, 10).toLocaleString('ja-JP') + '冁E;
                }

                const soldoutBadge = document.querySelector('.item__badge--soldout') ||
                                     document.querySelector('[class*="soldout"]') ||
                                     document.querySelector('[class*="SOLD"]') ||
                                     Array.from(document.querySelectorAll('*')).find(el => {
                                         const t = el.children.length === 0 ? el.textContent.trim() : '';
                                         return t === 'SOLDOUT' || t === 'SOLD OUT' || t === '売り�EめE || t === '売り�Eれました';
                                     });

                const purchaseBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('購入に進む'));

                isClosed = Boolean(soldoutBadge || !purchaseBtn);
            } else if (targetUrl.includes('paypayfleamarket') || targetUrl.includes('paypayfleamarket.yahoo.co.jp')) {
                const titleEl = document.querySelector('h1') || document.querySelector('[class*="ItemTitle_title"]') || document.querySelector('[class*="title"]');
                if (titleEl && titleEl.textContent) {
                    title = titleEl.textContent.trim();
                } else {
                    title = document.title
                        .replace(/\s*�E�\s*Yahoo!フリチE*/i, '')
                        .replace(/\s*-\s*PayPayフリチE*/i, '')
                        .trim();
                }

                const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
                if (metaPrice && metaPrice.getAttribute('content')) {
                    const pVal = parseInt(metaPrice.getAttribute('content'), 10);
                    if (!isNaN(pVal) && pVal > 0) {
                        price = pVal.toLocaleString('ja-JP') + '冁E;
                    }
                }

                if (!price) {
                    const purchaseBtnEl = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('購入手続きへ'));
                    if (purchaseBtnEl) {
                        let parent = purchaseBtnEl.parentElement;
                        while (parent && parent !== document.body) {
                            const text = parent.innerText || '';
                            const match = text.match(/([0-9,]{3,9})\s*冁E);
                            if (match) {
                                price = match[1] + '冁E;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }

                if (!price) {
                    const bodyText = document.body.innerText || '';
                    const m = bodyText.match(/([0-9,]{3,9})\s*冁E);
                    if (m) price = m[1] + '冁E;
                }

                const bodyText = document.body.innerText || '';
                const hasPurchaseBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('購入手続きへ'));
                const hasCopyBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('こ�E惁E��をコピ�Eして出品すめE));
                const isSoldText = bodyText.includes('売り�Eれました') || bodyText.includes('SOLD OUT') || bodyText.includes('公開が停止') || bodyText.includes('掲載が終亁E) || bodyText.includes('こ�E啁E��冁E��を使って新しく出品できまぁE);

                isClosed = Boolean(isSoldText || hasCopyBtn || !hasPurchaseBtn);
            }

            const statusText = isClosed ? '欠品E : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        return { ...info, html, page };
    } catch (e) {
        await page.close();
        console.error('Puppeteer error for', url, e.message);
        return { title: '取得エラー', price: '', isClosed: false, statusText: '販売中', html: '', page: null };
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
        let itemPage = null;
        if (targetUrl.includes('auctions.yahoo.co.jp')) {
            itemData = await getYahooItemData(targetUrl);
        } else {
            itemData = await getItemDataPuppeteer(browser, targetUrl);
            itemPage = itemData.page;
        }
        console.log(`Row ${r} Item Data:`, { title: itemData.title, price: itemData.price, isClosed: itemData.isClosed, statusText: itemData.statusText });

        // Image downloading is disabled during spreadsheet sync (only runs when clicking button in listing helper)
        if (itemPage) {
            await itemPage.close().catch(() => {});
        }

        // CHECK IF SOLDOUT (欠品E
        if (itemData.statusText === '欠品E) {
            console.log(`Row ${r} is 欠品E(SOLDOUT). Writing '欠品E into C${r} and F${r}. Moving to next row.`);
            await selectCell(`C${r}`);
            await overwriteCellText('欠品E);

            await selectCell(`F${r}`);
            await overwriteCellText('欠品E);
            continue;
        }

        // If 販売中 (Active):
        console.log(`Row ${r} is 販売中. Writing product name to C${r}...`);
        await selectCell(`C${r}`);
        await overwriteCellText(itemData.title);

        // Read current D{r} value before modifying
        await selectCell(`D${r}`);
        const currentDValue = await page.evaluate(() => {
            const el = document.querySelector('#t-formula-bar-input');
            return el ? el.textContent.trim() : '';
        });
        console.log(`Row ${r} Current D value:`, currentDValue);

        if (!currentDValue) {
            console.log(`Row ${r} D is empty. Writing New Price ('${itemData.price}') into D${r}...`);
            await selectCell(`D${r}`);
            await overwriteCellText(itemData.price);

            console.log(`Writing status '販売中' to F${r}...`);
            await selectCell(`F${r}`);
            await overwriteCellText('販売中');
        } else {
            console.log(`Row ${r} D is NOT empty ('${currentDValue}'). Overwriting E${r} with Old D Value...`);
            await selectCell(`E${r}`);
            await overwriteCellText(currentDValue);

            console.log(`Overwriting D${r} with New Price ('${itemData.price}')...`);
            await selectCell(`D${r}`);
            await overwriteCellText(itemData.price);

            const numD = parseNum(itemData.price);
            const numE = parseNum(currentDValue);
            console.log(`Row ${r} Compare D (${numD}) vs E (${numE})`);

            if (numD !== null && numE !== null && numD > numE) {
                console.log(`Row ${r}: Price INCREASED (${numD} > ${numE}). Writing '値上げ' to F${r}...`);
                await selectCell(`F${r}`);
                await overwriteCellText('値上げ');
            } else {
                console.log(`Row ${r}: Price same or lower. Writing '販売中' to F${r}...`);
                await selectCell(`F${r}`);
                await overwriteCellText('販売中');
            }

            if (numD !== numE && numE !== null) {
                console.log(`Row ${r}: Prices differ! Highlighting D${r} in RED...`);
                await setCellRedBackground(`D${r}`);
            }
        }
    }

    console.log('Waiting for auto-save...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

    await browser.close();
    console.log('Run current batch completed successfully!');
    process.exit(0);
})();

