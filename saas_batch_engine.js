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
            if (fs.existsSync(p)) return p;
        }
        return '/usr/bin/chromium';
    }
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}
const executablePath = getExecutablePath();

const USERS_CONFIG_PATH = path.join(__dirname, 'users_config.json');

function loadUsersConfig() {
    try {
        if (fs.existsSync(USERS_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(USERS_CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveUsersConfig(users) {
    try {
        fs.writeFileSync(USERS_CONFIG_PATH, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {}
}

function sendLineNotificationForUser(user, message) {
    return new Promise((resolve) => {
        const token = user.lineChannelAccessToken;
        const userId = user.lineUserId;

        if (!token || !userId) {
            console.log(`[LINE Notify Sim] (${user.name}):\n${message}`);
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
            console.log(`[LINE Response - ${user.name}]: Status ${res.statusCode}`);
            resolve(res.statusCode === 200);
        });

        req.on('error', (e) => {
            console.error(`[LINE Error - ${user.name}]:`, e.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
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

async function getItemDataPuppeteerOnce(browser, url) {
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

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
                title = titleEl ? titleEl.textContent.trim() : '';
                if (!title) {
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle && ogTitle.getAttribute('content')) {
                        title = ogTitle.getAttribute('content').replace(/\s*-\s*メルカリ.*/i, '').trim();
                    }
                }

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

                isClosed = Boolean(soldoutBadge);
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
                const hasCopyBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('この情報をコピーして出品する'));
                const isSoldText = bodyText.includes('売り切れました') || bodyText.includes('SOLD OUT') || bodyText.includes('公開が停止') || bodyText.includes('掲載が終了') || bodyText.includes('この情報を使って新しく出品できます');

                isClosed = Boolean(isSoldText || hasCopyBtn);
            }

            const statusText = isClosed ? '欠品' : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        if (url.includes('mercari.com') || url.includes('mercari')) {
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
                if (ogTitle) info.title = ogTitle[1].replace(/\s*-\s*メルカリ.*/i, '').trim();
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
        return { title: '', price: '', isClosed: false, statusText: '販売中', html: '', page: null };
    }
}

async function getItemDataPuppeteer(browser, url) {
    let attempts = 0;
    let result = null;

    while (attempts < 2) {
        attempts++;
        result = await getItemDataPuppeteerOnce(browser, url);
        const isValid = result.title && result.title !== '取得エラー' && (result.title !== 'Amazon.co.jp' || result.price);
        if (isValid) return result;
        if (result.page) {
            await result.page.close().catch(() => {});
            result.page = null;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    return result || { title: '', price: '', isClosed: false, statusText: '販売中', html: '', page: null };
}

(async () => {
    console.log('🚀 [SaaS Engine] Multi-User Batch Execution Started...');
    const users = loadUsersConfig();
    const activeUsers = users.filter(u => u.enabled !== false);

    const cliModeArg = process.argv.find(arg => arg.startsWith('--mode='));
    const overrideMode = cliModeArg ? cliModeArg.split('=')[1] : process.env.SYNC_MODE;

    console.log(`Found ${activeUsers.length} active users to process.${overrideMode ? ` [UI Mode Override: ${overrideMode}]` : ''}`);

    if (activeUsers.length === 0) {
        console.log('No active users to process. Exiting.');
        process.exit(0);
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1400,900']
    });

    for (const user of activeUsers) {
        const effectiveMode = overrideMode || user.mode || 'line_transfer';
        console.log(`\n==================================================`);
        console.log(`👤 Processing User: [${user.name}] (ID: ${user.id})`);
        console.log(`Spreadsheet ID: ${user.spreadsheetId}`);
        console.log(`Effective Mode: ${effectiveMode}`);
        console.log(`==================================================`);

        try {
            const sheetData = await sheets.spreadsheets.get({
                spreadsheetId: user.spreadsheetId,
                includeGridData: true,
                ranges: ['A1:G100']
            });

            const rowValues = sheetData.data.sheets[0].data[0].rowData || [];
            console.log(`User [${user.name}] Sheet: Found ${rowValues.length} rows.`);

            const missingItemsList = [];
            const priceChangedItemsList = [];

            for (let r = 2; r <= rowValues.length; r++) {
                const rowObj = rowValues[r - 1];
                if (!rowObj || !rowObj.values || rowObj.values.length < 2) break;

                const bCell = rowObj.values[1] || {};
                const bFormatted = bCell.formattedValue || '';
                let targetUrl = bCell.hyperlink || '';

                if (!targetUrl && bCell.textRuns) {
                    for (const run of bCell.textRuns) {
                        if (run.hyperlink) { targetUrl = run.hyperlink; break; }
                    }
                }
                if (!targetUrl && bCell.textFormatRuns && Array.isArray(bCell.textFormatRuns)) {
                    for (const run of bCell.textFormatRuns) {
                        if (run.format && run.format.link && run.format.link.uri) {
                            targetUrl = run.format.link.uri; break;
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

                if (!bFormatted && !targetUrl) break;
                if (!targetUrl || !targetUrl.includes('http')) continue;

                const gCell = (rowObj.values.length > 6 ? rowObj.values[6] : {}) || {};
                let gValue = gCell.hyperlink || (gCell.userEnteredValue && gCell.userEnteredValue.formulaValue) || gCell.formattedValue || '';

                console.log(`[User: ${user.name}] Row ${r} Processing URL: ${targetUrl}`);
                const itemData = await getItemDataPuppeteer(browser, targetUrl);
                if (itemData.page) await itemData.page.close().catch(() => {});

                console.log(`Row ${r} Result:`, { title: itemData.title, price: itemData.price, isClosed: itemData.isClosed });

                const dCell = rowObj.values[3] || {};
                const eCell = rowObj.values[4] || {};
                const currentDValue = dCell.formattedValue || '';
                const currentEValue = eCell.formattedValue || '';

                let newTitle = '';
                let newD = '';
                let newE = '';
                let newF = '';
                let newG = (rowObj.values.length > 6 && rowObj.values[6] ? rowObj.values[6].formattedValue : '') || '';

                const isItemMissing = Boolean(itemData.isClosed || itemData.statusText === '欠品');

                if (isItemMissing) {
                    newTitle = '欠品';
                    newD = currentDValue;
                    newE = currentEValue;
                    newF = '欠品';
                    if (effectiveMode === 'soldout_g') newG = '出品取り消し';

                    missingItemsList.push({ row: r, bUrl: targetUrl, gUrl: gValue });
                } else if (!itemData.title || itemData.title === '取得エラー' || (itemData.title === 'Amazon.co.jp' && !itemData.price)) {
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
                                newF = '値上げ';
                                priceChangedItemsList.push({ row: r, type: '値上げ', oldPrice: currentDValue, newPrice: itemData.price, bUrl: targetUrl, gUrl: gValue });
                            } else {
                                newF = '↓下げ';
                                priceChangedItemsList.push({ row: r, type: '↓下げ', oldPrice: currentDValue, newPrice: itemData.price, bUrl: targetUrl, gUrl: gValue });
                            }
                        } else {
                            newD = currentDValue;
                            // もし旧価格E列に誤ってD列と同じ数値が入っている場合は空欄にクリーンアップし、本物の旧価格または空欄を維持
                            newE = (currentEValue && currentEValue === currentDValue) ? '' : currentEValue;
                            newF = '販売中';
                        }
                    }
                }

                const cCell = rowObj.values[2] || {};
                const fCell = rowObj.values[5] || {};
                const currentCValue = cCell.formattedValue || '';
                const currentFValue = fCell.formattedValue || '';

                const hasChanges = (
                    newTitle !== currentCValue ||
                    newD !== currentDValue ||
                    newE !== currentEValue ||
                    newF !== currentFValue ||
                    (effectiveMode === 'soldout_g' && newG !== ((rowObj.values.length > 6 && rowObj.values[6]) ? rowObj.values[6].formattedValue || '' : ''))
                );

                if (!hasChanges) {
                    console.log(`[User: ${user.name}] Row ${r}: 変更なしのためセル上書きをスキップしました (旧価格・初期価格をそのまま保持)`);
                } else {
                    if (effectiveMode === 'soldout_g') {
                        await sheets.spreadsheets.values.update({
                            spreadsheetId: user.spreadsheetId,
                            range: `C${r}:G${r}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[ newTitle, newD, newE, newF, newG ]] }
                        });
                    } else {
                        await sheets.spreadsheets.values.update({
                            spreadsheetId: user.spreadsheetId,
                            range: `C${r}:F${r}`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: { values: [[ newTitle, newD, newE, newF ]] }
                        });
                    }
                }
            }

            // LINE notification depending on effectiveMode (LINE通知モード時のみ送信)
            if (effectiveMode === 'line_transfer' && (missingItemsList.length > 0 || priceChangedItemsList.length > 0)) {
                let lineBatchMsg = `【商管どん SaaS 自動通知】\n`;
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
                await sendLineNotificationForUser(user, lineBatchMsg);
            } else {
                console.log(`[Mode: ${effectiveMode}] LINE通知対象外のモードのため、LINEメッセージの送信を完全にスキップしました。`);
            }

            user.lastSyncTime = new Date().toLocaleString('ja-JP');
            user.lastStatus = `正常完了 (欠品: ${missingItemsList.length}件, 価格変更: ${priceChangedItemsList.length}件)`;

        } catch (err) {
            console.error(`Error processing user [${user.name}]:`, err.message);
            user.lastStatus = `エラー: ${err.message}`;
        }
    }

    saveUsersConfig(users);
    await browser.close();
    console.log('\n✅ [SaaS Engine] All active users batch process completed!');
    process.exit(0);
})();
