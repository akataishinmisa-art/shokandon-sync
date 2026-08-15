const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { google } = require('googleapis');

function getExecutablePath() {
    if (process.platform === 'linux') {
        const candidates = [
            process.env.CHROMIUM_PATH,
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable'
        ].filter(Boolean);
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                console.log(`[Browser] Linux: using ${p}`);
                return p;
            }
        }
        console.log('[Browser] Linux: defaulting to /usr/bin/chromium');
        return '/usr/bin/chromium';
    }
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const chosen = fs.existsSync(chromePath) ? chromePath : edgePath;
    console.log(`[Browser] Windows: using ${chosen}`);
    return chosen;
}
const executablePath = getExecutablePath();

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SPREADSHEET_ID = '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4';

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return { lineChannelAccessToken: '', lineUserId: '' };
}

function sendLineNotification(message) {
    return new Promise((resolve) => {
        const cfg = loadConfig();
        const token = cfg.lineChannelAccessToken;
        const userId = cfg.lineUserId;

        if (!token || !userId) {
            console.log(`[LINE Notify Sim] 📱 (LINE設定未保存のため出力のみ):\n${message}`);
            return resolve(true);
        }

        const payload = JSON.stringify({
            to: userId,
            messages: [{ type: 'text', text: message }]
        });

        const req = https.request('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            console.log(`[LINE Messaging API Response]: Status ${res.statusCode}`);
            resolve(res.statusCode === 200);
        });

        req.on('error', (e) => {
            console.error('[LINE Messaging API Error]:', e.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
}

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
    return { title, price, isClosed, statusText, html };
}

async function getRakumaItemDataDirect(url) {
    try {
        const html = await fetchHtml(url);
        let title = '';
        let price = '';
        let isClosed = false;

        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                           html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1]
                .replace(/\s*-\s*ラクマ.*/i, '')
                .replace(/\s*\|\s*ラクマ.*/i, '')
                .replace(/通販\s*by\s*.*/i, '')
                .trim();
        }

        const priceMatch = html.match(/<meta\s+property="product:price:amount"\s+content="([0-9]+)"/i) ||
                           html.match(/"price":\s*([0-9]+)/) ||
                           html.match(/class="item__price[^"]*">\s*￥?\s*([0-9,]+)/i);
        if (priceMatch && priceMatch[1]) {
            price = parseInt(priceMatch[1].replace(/,/g, ''), 10).toLocaleString('ja-JP') + '円';
        }

        if (html.includes('該当の商品は削除されました') || html.includes('商品が見つかりませんでした') || html.includes('指定されたページは見つかりませんでした')) {
            isClosed = true;
            title = '欠品（削除された商品）';
        } else if (html.includes('item__badge--soldout') || html.includes('SOLD OUT') || html.includes('売り切れました')) {
            isClosed = true;
        }

        const statusText = isClosed ? '欠品' : '販売中';
        return { title, price, isClosed, statusText, html };
    } catch (e) {
        return null;
    }
}

async function getItemDataPuppeteerOnce(browser, url, waitMs = 2500) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.evaluate((delay) => new Promise(r => setTimeout(r, delay)), waitMs);

        const html = await page.content();
        let info = await page.evaluate((targetUrl) => {
            let title = '';
            let price = '';
            let isClosed = false;

            if (targetUrl.includes('amazon.co.jp')) {
                const titleEl = document.querySelector('#productTitle') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : '';
                if (!title || title === 'Amazon.co.jp') {
                    const ogTitle = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="title"]');
                    if (ogTitle && ogTitle.getAttribute('content')) {
                        title = ogTitle.getAttribute('content').replace(/^Amazon\s*\|\s*/i, '').trim();
                    }
                }
                if (!title || title === 'Amazon.co.jp') {
                    title = document.title.replace(/^Amazon\s*\|\s*/i, '').trim();
                }

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
            } else if (targetUrl.includes('mercari.com')) {
                const bodyText = document.body.innerText || '';
                const isDeleted = bodyText.includes('該当する商品は削除されています') ||
                                  bodyText.includes('この商品は削除されました') ||
                                  bodyText.includes('削除された商品') ||
                                  bodyText.includes('商品が見つかりません') ||
                                  bodyText.includes('ページが見つかりません');

                const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : '';
                if (!title) {
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle && ogTitle.getAttribute('content')) {
                        title = ogTitle.getAttribute('content').replace(' - メルカリ', '').trim();
                    }
                }
                if (!title || title.includes('日本最大のフリマサービス') || document.title.includes('日本最大のフリマサービス')) {
                    title = '欠品（削除された商品）';
                }

                if (isDeleted || title.includes('欠品（削除された商品）')) {
                    isClosed = true;
                } else {
                    const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
                    if (metaPrice && metaPrice.getAttribute('content')) {
                        const pVal = parseInt(metaPrice.getAttribute('content'), 10);
                        if (!isNaN(pVal) && pVal > 0) {
                            price = pVal.toLocaleString('ja-JP') + '円';
                        }
                    }

                    if (!price) {
                        const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
                        let rawPrice = priceEl ? priceEl.textContent.trim() : '';
                        const cleanDigits = rawPrice.replace(/[^0-9]/g, '');
                        if (cleanDigits) {
                            price = parseInt(cleanDigits, 10).toLocaleString('ja-JP') + '円';
                        }
                    }

                    const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                                      document.querySelector('div[aria-label*="売り切れ"]');
                    const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
                    const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';

                    isClosed = Boolean(soldBadge || (checkoutBtn && checkoutBtn.disabled && btnText.includes('売り切れ')));
                }
            } else if (targetUrl.includes('fril.jp') || targetUrl.includes('rakuma')) {
                const bodyText = document.body.innerText || '';
                const isDeleted = bodyText.includes('該当の商品は削除されました') ||
                                  bodyText.includes('商品が見つかりませんでした') ||
                                  bodyText.includes('この商品は削除されました') ||
                                  bodyText.includes('指定されたページは見つかりませんでした');

                const titleEl = document.querySelector('.item__name') ||
                                document.querySelector('[class*="item__name"]') ||
                                document.querySelector('.item-header__name') ||
                                document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\s*-\s*ラクマ.*/i, '').trim();

                if (isDeleted || title.includes('フリマアプリ ラクマ')) {
                    isClosed = true;
                    if (!title || title.includes('フリマアプリ')) {
                        title = '欠品（削除された商品）';
                    }
                } else {
                    const priceEl = document.querySelector('[itemprop="price"]') ||
                                    document.querySelector('.item__price') ||
                                    document.querySelector('.item-price') ||
                                    document.querySelector('[class*="item__price"]');
                    let rawPrice = priceEl ? (priceEl.getAttribute('content') || priceEl.textContent.trim()) : '';
                    const cleanNum = rawPrice.replace(/[^0-9]/g, '');
                    if (cleanNum) {
                        price = parseInt(cleanNum, 10).toLocaleString('ja-JP') + '円';
                    }

                    const soldoutBadge = document.querySelector('.item__badge--soldout') ||
                                         document.querySelector('[class*="soldout"]') ||
                                         document.querySelector('[class*="SOLD"]') ||
                                         Array.from(document.querySelectorAll('*')).find(el => {
                                             const t = el.children.length === 0 ? el.textContent.trim() : '';
                                             return t === 'SOLDOUT' || t === 'SOLD OUT' || t === '売り切れ' || t === '売り切れました';
                                         });

                    isClosed = Boolean(soldoutBadge || isDeleted);
                }
            } else if (targetUrl.includes('paypayfleamarket') || targetUrl.includes('paypayfleamarket.yahoo.co.jp')) {
                const bodyText = document.body.innerText || '';
                const isDeleted = bodyText.includes('公開が停止') ||
                                  bodyText.includes('掲載が終了') ||
                                  bodyText.includes('削除された商品') ||
                                  bodyText.includes('商品が見つかりません') ||
                                  bodyText.includes('この商品は削除されました');
                const titleEl = document.querySelector('h1') || document.querySelector('[class*="ItemTitle_title"]') || document.querySelector('[class*="title"]');
                if (titleEl && titleEl.textContent) {
                    title = titleEl.textContent.trim();
                } else {
                    title = document.title
                        .replace(/\s*-\s*Yahoo!フリマ.*/i, '')
                        .replace(/\s*-\s*PayPayフリマ.*/i, '')
                        .trim();
                }

                const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
                if (metaPrice && metaPrice.getAttribute('content')) {
                    const pVal = parseInt(metaPrice.getAttribute('content'), 10);
                    if (!isNaN(pVal) && pVal > 0) {
                        price = pVal.toLocaleString('ja-JP') + '円';
                    }
                }

                if (!price) {
                    const bodyText = document.body.innerText || '';
                    const m = bodyText.match(/([0-9,]{3,9})\s*円/);
                    if (m) price = m[1] + '円';
                }

                const isSoldText = bodyText.includes('売り切れました') || bodyText.includes('SOLD OUT') || bodyText.includes('公開が停止') || bodyText.includes('掲載が終了') || bodyText.includes('この情報を使って新しく出品できます');

                isClosed = Boolean(isSoldText || isDeleted);
            }

            const statusText = isClosed ? '欠品' : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        // HTML/JSON Backup extraction if DOM evaluation returned incomplete data
        if (url.includes('mercari.com')) {
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
            if (nextDataMatch) {
                try {
                    const nextJson = JSON.parse(nextDataMatch[1]);
                    const itemObj = (nextJson.props && nextJson.props.pageProps && (nextJson.props.pageProps.item || (nextJson.props.pageProps.initialState && nextJson.props.pageProps.initialState.item))) || null;
                    if (itemObj) {
                        if (!info.title || info.title === 'メルカリ') info.title = itemObj.name || info.title;
                        if (!info.price && itemObj.price) info.price = parseInt(itemObj.price, 10).toLocaleString('ja-JP') + '円';
                        if (itemObj.status === 'ITEM_STATUS_SOLDOUT' || itemObj.status === 'ITEM_STATUS_TRADING') {
                            info.isClosed = true;
                            info.statusText = '欠品';
                        } else if (itemObj.status === 'ITEM_STATUS_ON_SALE') {
                            info.isClosed = false;
                            info.statusText = '販売中';
                        }
                    }
                } catch (e) {}
            }
            if (!info.title || info.title === 'メルカリ') {
                const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
                if (ogTitle) info.title = ogTitle[1].replace(' - メルカリ', '').trim();
            }
            if (!info.price) {
                const metaPrice = html.match(/<meta\s+(?:name|property)="product:price:amount"\s+content="([0-9]+)"/i);
                if (metaPrice) info.price = parseInt(metaPrice[1], 10).toLocaleString('ja-JP') + '円';
            }
            if (html.includes('"isSoldOut":true') || html.includes('ITEM_STATUS_SOLDOUT')) {
                info.isClosed = true;
                info.statusText = '欠品';
            }
        } else if (url.includes('amazon.co.jp')) {
            if (!info.title || info.title === 'Amazon.co.jp') {
                const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>(.*?)<\/title>/i);
                if (ogTitle) info.title = ogTitle[1].replace(/^Amazon\s*\|\s*/i, '').trim();
            }
            if (!info.price) {
                const priceMatch = html.match(/class="a-price-whole">([0-9,]+)/i) || html.match(/￥\s*([0-9,]+)/);
                if (priceMatch && priceMatch[1]) {
                    const pDigits = priceMatch[1].replace(/,/g, '');
                    if (pDigits) info.price = parseInt(pDigits, 10).toLocaleString('ja-JP') + '円';
                }
            }
        }

        return { ...info, html, page };
    } catch (e) {
        await page.close().catch(() => {});
        console.error('Puppeteer error for', url, e.message);
        return { title: '', price: '', isClosed: false, statusText: '販売中', html: '', page: null };
    }
}

async function getItemDataPuppeteer(browser, url) {
    let attempts = 0;
    const maxAttempts = 5;
    let result = null;

    while (attempts < maxAttempts) {
        attempts++;
        const currentWait = (attempts === 1) ? 2500 : 4000;
        result = await getItemDataPuppeteerOnce(browser, url, currentWait);
        const isValid = result.title && result.title !== '取得エラー' && (result.title !== 'Amazon.co.jp' || result.price);
        
        if (isValid && !result.isClosed && result.price) {
            return result;
        }

        if (isValid && result.isClosed && attempts >= 2) {
            return result;
        }

        if (result.page) {
            await result.page.close().catch(() => {});
            result.page = null;
        }
        console.log(`[Scrape Check Attempt ${attempts}/${maxAttempts}]: ${url} (Wait: ${currentWait}ms) -> Retrying for accuracy...`);
        await new Promise(r => setTimeout(r, 2000));
    }

    if (!result || !result.title || result.title === '取得エラー' || (!result.price && !result.isClosed)) {
        return {
            title: (result && result.title && result.title !== '取得エラー') ? result.title : '',
            price: '',
            isClosed: false,
            statusText: 'エラー',
            html: '',
            page: null
        };
    }

    return result;
}

function getGoogleAuth() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    const keyPath = path.join(__dirname, 'google_service_account.json');
    if (fs.existsSync(keyPath)) {
        return new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    throw new Error('Google Service Account credentials not found!');
}

const parseNum = (val) => {
    if (!val) return null;
    const cleaned = val.replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : null;
};

(async () => {
    console.log('🚀 Connecting to Google Sheets API...');
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('📊 Fetching Spreadsheet Grid Data...');
    const sheetData = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: ['A1:G100']
    });

    const rowValues = sheetData.data.sheets[0].data[0].rowData || [];
    console.log(`Found ${rowValues.length} rows in Spreadsheet.`);

    console.log('🌐 Launching Puppeteer browser for web scraping...');
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const missingItemsList = [];

    for (let r = 2; r <= rowValues.length; r++) {
        const rowObj = rowValues[r - 1];
        if (!rowObj || !rowObj.values || rowObj.values.length < 2) {
            console.log(`Row ${r}: No B column data. Stopping.`);
            break;
        }

        const bCell = rowObj.values[1] || {};
        const bFormatted = bCell.formattedValue || '';
        let targetUrl = bCell.hyperlink || '';

        if (!targetUrl && bCell.textFormatRuns && Array.isArray(bCell.textFormatRuns)) {
            for (const run of bCell.textFormatRuns) {
                if (run.format && run.format.link && run.format.link.uri) {
                    targetUrl = run.format.link.uri;
                    break;
                }
            }
        }
        if (!targetUrl && bCell.userEnteredValue && bCell.userEnteredValue.formulaValue) {
            const match = bCell.userEnteredValue.formulaValue.match(/https?:\/\/[^\s"'\)\,\;]+/i);
            if (match) targetUrl = match[0];
        }
        if (!targetUrl) {
            const jsonStr = JSON.stringify(bCell);
            const match = jsonStr.match(/https?:\/\/[^\s"'\\]+/i);
            if (match) targetUrl = match[0];
        }
        if (!targetUrl && bFormatted.startsWith('http')) {
            targetUrl = bFormatted;
        }

        if (!bFormatted && !targetUrl) {
            console.log(`Row ${r}: B column is empty. Reached end of sheet data.`);
            break;
        }

        if (!targetUrl || !targetUrl.includes('http')) {
            console.log(`Row ${r}: B column text ('${bFormatted}') contains no valid HTTP URL. Skipping row.`);
            continue;
        }

        const gCell = (rowObj.values.length > 6 ? rowObj.values[6] : {}) || {};
        let gValue = gCell.hyperlink || (gCell.userEnteredValue && gCell.userEnteredValue.formulaValue) || gCell.formattedValue || '';

        console.log(`\n================ Processing Row ${r} ================`);
        console.log(`Row ${r} URL:`, targetUrl);

        let itemData;
        let itemPage = null;
        if (targetUrl.includes('auctions.yahoo.co.jp')) {
            itemData = await getYahooItemData(targetUrl);
        } else if (targetUrl.includes('fril.jp') || targetUrl.includes('rakuma')) {
            itemData = await getRakumaItemDataDirect(targetUrl);
            if (!itemData || !itemData.title || itemData.title === '取得エラー') {
                itemData = await getItemDataPuppeteer(browser, targetUrl);
                itemPage = itemData.page;
            }
        } else {
            itemData = await getItemDataPuppeteer(browser, targetUrl);
            itemPage = itemData.page;
        }

        console.log(`Row ${r} Item Data:`, { title: itemData.title, price: itemData.price, isClosed: itemData.isClosed, statusText: itemData.statusText });

        if (itemPage) {
            await itemPage.close().catch(() => {});
        }

        const cCell = rowObj.values[2] || {};
        const dCell = rowObj.values[3] || {};
        const eCell = rowObj.values[4] || {};
        const currentDValue = dCell.formattedValue || '';
        const currentEValue = eCell.formattedValue || '';

        let newTitle = '';
        let newD = '';
        let newE = '';
        let newF = '';

        const isItemMissing = Boolean(itemData.isClosed || itemData.statusText === '欠品');

        if (itemData.statusText === 'エラー') {
            console.log(`Row ${r}: 5回判定でも取得不可のためステータスを'エラー'と記載しました。`);
            const cCell = rowObj.values[2] || {};
            newTitle = cCell.formattedValue || '';
            newD = currentDValue;
            newE = currentEValue;
            newF = 'エラー';
        } else if (isItemMissing) {
            console.log(`Row ${r} is 欠品 (SOLDOUT). Writing '欠品' to C and F.`);
            newTitle = '欠品';
            newD = currentDValue;
            newE = currentEValue;
            newF = '欠品';

            missingItemsList.push({
                row: r,
                bUrl: targetUrl,
                gUrl: gValue
            });
        } else if (!itemData.title || itemData.title === '取得エラー' || (itemData.title === 'Amazon.co.jp' && !itemData.price)) {
            console.log(`Row ${r}: Scraping failed or returned invalid placeholder ('${itemData.title}'). Preserving existing sheet values.`);
            const cCell = rowObj.values[2] || {};
            const fCell = rowObj.values[5] || {};
            newTitle = cCell.formattedValue || '';
            newD = currentDValue;
            newE = currentEValue;
            newF = fCell.formattedValue || '販売中';
        } else {
            newTitle = itemData.title || (rowObj.values[2] ? rowObj.values[2].formattedValue : '');
            if (!itemData.price) {
                newD = currentDValue;
                newE = currentEValue;
                newF = '販売中';
            } else if (!currentDValue) {
                console.log(`Row ${r} D is empty. Writing price '${itemData.price}' to D.`);
                newD = itemData.price;
                newE = currentEValue;
                newF = '販売中';
            } else {
                const numScraped = parseNum(itemData.price);
                const numD = parseNum(currentDValue);

                if (numScraped !== null && numD !== null && numScraped !== numD) {
                    newE = currentDValue;
                    newD = itemData.price;

                    if (numScraped > numD) {
                        console.log(`Row ${r}: Price INCREASED (${numScraped} > ${numD}). Status: '値上げ'`);
                        newF = '値上げ';
                        priceChangedItemsList.push({ row: r, type: '値上げ', oldPrice: currentDValue, newPrice: itemData.price, bUrl: targetUrl, gUrl: gValue });
                    } else {
                        console.log(`Row ${r}: Price DECREASED (${numScraped} < ${numD}). Status: '↓下げ'`);
                        newF = '↓下げ';
                        priceChangedItemsList.push({ row: r, type: '↓下げ', oldPrice: currentDValue, newPrice: itemData.price, bUrl: targetUrl, gUrl: gValue });
                    }
                } else {
                    newD = currentDValue;
                    newE = (currentEValue && currentEValue === currentDValue) ? '' : currentEValue;
                    newF = '販売中';
                }
            }
        }

        const currentCValue = cCell.formattedValue || '';
        const fCell = rowObj.values[5] || {};
        const currentFValue = fCell.formattedValue || '';

        const hasChanges = (
            newTitle !== currentCValue ||
            newD !== currentDValue ||
            newE !== currentEValue ||
            newF !== currentFValue
        );

        if (!hasChanges) {
            console.log(`Row ${r}: 変更なしのためセル上書きをスキップしました (旧価格・初期価格をそのまま保持)`);
        } else {
            console.log(`Row ${r} Updating Google Sheets API C${r}:F${r} ->`, [newTitle, newD, newE, newF]);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `C${r}:F${r}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[ newTitle, newD, newE, newF ]]
                }
            });
        }
    }

    await browser.close();

    if (missingItemsList.length > 0 || priceChangedItemsList.length > 0) {
        console.log(`\n================ Sending Batch LINE Notification ================`);
        let lineBatchMsg = `【商管どん 自動通知】\n`;
        if (missingItemsList.length > 0) {
            lineBatchMsg += `\n⚠️【欠品（要出品取り消し）】 ${missingItemsList.length}件：\n`;
            for (const item of missingItemsList) {
                lineBatchMsg += `要出品取り消し\n${item.bUrl}\n${item.gUrl}\n\n`;
            }
        }
        if (priceChangedItemsList.length > 0) {
            lineBatchMsg += `\n💰【価格変更通知（要確認）】 ${priceChangedItemsList.length}件：\n`;
            for (const item of priceChangedItemsList) {
                lineBatchMsg += `【${item.type}】 ${item.oldPrice} ➔ ${item.newPrice}\n${item.bUrl}\n${item.gUrl}\n\n`;
            }
        }
        lineBatchMsg = lineBatchMsg.trim();
        console.log(`Batch LINE Message Content:\n${lineBatchMsg}`);
        await sendLineNotification(lineBatchMsg);
    } else {
        console.log('No missing items found. No LINE notification sent.');
    }

    console.log('✅ Auto-sync via Google Sheets API completed successfully!');
    process.exit(0);
})();
