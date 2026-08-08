const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { google } = require('googleapis');

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

                if (priceEl) {
                    const cleanDigits = priceEl.textContent.replace(/[^0-9]/g, '');
                    if (cleanDigits) {
                        price = parseInt(cleanDigits, 10).toLocaleString('ja-JP') + '円';
                    }
                }

                const outOfStockEl = document.querySelector('#outOfStock') || document.querySelector('#availability');
                const outText = outOfStockEl ? outOfStockEl.textContent.trim() : '';
                isClosed = Boolean(outText.includes('現在在庫切れ') || outText.includes('一時的に在庫切れ') || outText.includes('この商品は現在お取り扱いできません'));
            } else if (targetUrl.includes('mercari') || targetUrl.includes('jp.mercari.com')) {
                const titleEl = document.querySelector('h1') || document.querySelector('[data-testid="item-name"]');
                title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\s*-\s*メルカリ.*/i, '').trim();

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
            } else if (targetUrl.includes('fril.jp') || targetUrl.includes('rakuma')) {
                const titleEl = document.querySelector('.item__name') ||
                                document.querySelector('[class*="item__name"]') ||
                                document.querySelector('.item-header__name') ||
                                document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\s*-\s*ラクマ.*/i, '').trim();

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

                const purchaseBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('購入に進む'));

                isClosed = Boolean(soldoutBadge || !purchaseBtn);
            } else if (targetUrl.includes('paypayfleamarket') || targetUrl.includes('paypayfleamarket.yahoo.co.jp')) {
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
                    const purchaseBtnEl = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('購入手続きへ'));
                    if (purchaseBtnEl) {
                        let parent = purchaseBtnEl.parentElement;
                        while (parent && parent !== document.body) {
                            const text = parent.innerText || '';
                            const match = text.match(/([0-9,]{3,9})\s*円/);
                            if (match) {
                                price = match[1] + '円';
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }

                if (!price) {
                    const bodyText = document.body.innerText || '';
                    const m = bodyText.match(/([0-9,]{3,9})\s*円/);
                    if (m) price = m[1] + '円';
                }

                const bodyText = document.body.innerText || '';
                const hasPurchaseBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('購入手続きへ'));
                const hasCopyBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('この情報をコピーして出品する'));
                const isSoldText = bodyText.includes('売り切れました') || bodyText.includes('SOLD OUT') || bodyText.includes('公開が停止') || bodyText.includes('掲載が終了') || bodyText.includes('この情報を使って新しく出品できます');

                isClosed = Boolean(isSoldText || hasCopyBtn || !hasPurchaseBtn);
            }

            const statusText = isClosed ? '欠品' : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        return { ...info, html, page };
    } catch (e) {
        await page.close();
        console.error('Puppeteer error for', url, e.message);
        return { title: '取得エラー', price: '', isClosed: false, statusText: '販売中', html: '', page: null };
    }
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

    console.log(`🌐 Launching Puppeteer browser for web scraping...`);
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    };
    if (executablePath && fs.existsSync(executablePath)) {
        launchOptions.executablePath = executablePath;
    }
    const browser = await puppeteer.launch(launchOptions);

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

        if (!targetUrl && bCell.textRuns) {
            for (const run of bCell.textRuns) {
                if (run.hyperlink) {
                    targetUrl = run.hyperlink;
                    break;
                }
            }
        }
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
        if (!targetUrl && bFormatted) {
            const match = bFormatted.match(/https?:\/\/[^\s"'\)\,\;]+/i);
            if (match) targetUrl = match[0];
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

        if (itemData.statusText === '欠品') {
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
        } else {
            newTitle = itemData.title;
            if (!currentDValue) {
                console.log(`Row ${r} D is empty. Writing price '${itemData.price}' to D.`);
                newD = itemData.price;
                newE = currentEValue;
                newF = '販売中';
            } else {
                newE = currentDValue;
                newD = itemData.price;
                const numD = parseNum(itemData.price);
                const numE = parseNum(currentDValue);
                if (numD !== null && numE !== null && numD > numE) {
                    console.log(`Row ${r}: Price INCREASED (${numD} > ${numE}). Status: '値上げ'`);
                    newF = '値上げ';
                } else {
                    console.log(`Row ${r}: Status: '販売中'`);
                    newF = '販売中';
                }
            }
        }

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

    await browser.close();

    if (missingItemsList.length > 0) {
        console.log(`\n[標準モード] 欠品商品が${missingItemsList.length}件検出されましたが、標準モードのためLINE通知は送信しません（LINE通数節約）。`);
    } else {
        console.log('欠品商品は検出されませんでした。');
    }

    console.log('✅ Auto-sync via Google Sheets API completed successfully!');
    process.exit(0);
})();
