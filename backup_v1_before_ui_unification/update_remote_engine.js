const fs = require('fs');

const content = `const puppeteer = require('puppeteer-core');
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
    const chromePath = 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
    const edgePath = 'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}
const executablePath = getExecutablePath();

const USERS_CONFIG_PATH = path.join(__dirname, 'users_config.json');
const LOCK_FILE = path.join(__dirname, 'batch_sync.lock');

if (fs.existsSync(LOCK_FILE)) {
    try {
        const stats = fs.statSync(LOCK_FILE);
        const now = Date.now();
        if (now - stats.mtimeMs < 30 * 60 * 1000) {
            console.log('⚠️ [Single Instance Lock]: 他の同期処理が現在実行中のため、重複書き込みを防止し即座に終了します。');
            process.exit(0);
        }
    } catch (e) {}
}

try {
    fs.writeFileSync(LOCK_FILE, process.pid.toString(), 'utf8');
} catch (e) {}

function removeLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    } catch (e) {}
}
process.on('exit', removeLock);
process.on('SIGINT', () => { removeLock(); process.exit(0); });
process.on('uncaughtException', (err) => { removeLock(); console.error(err); process.exit(1); });

function loadUsersConfig() {
    try {
        if (fs.existsSync(USERS_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(USERS_CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchHtml(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('HTTP Timeout')); });
    });
}

async function getYahooItemData(url) {
    try {
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
            const titleMatch = html.match(/<title>(.*?)<\\/title>/i);
            title = titleMatch ? titleMatch[1].replace(' - Yahoo!オークション', '').replace(' - ヤフオク!', '').trim() : '';
        }

        if (html.includes('このオークションは終了しています') || html.includes('オークション終了')) {
            isClosed = true;
        }

        const statusText = isClosed ? '欠品' : '販売中';
        return { title, price, isClosed, statusText };
    } catch (e) {
        return null;
    }
}

async function getRakumaItemDataDirect(url) {
    try {
        const html = await fetchHtml(url);
        let title = '';
        let price = '';
        let isClosed = false;

        const titleMatch = html.match(/<meta\\s+property="og:title"\\s+content="([^"]+)"/i) ||
                           html.match(/<title>(.*?)<\\/title>/i);
        if (titleMatch) {
            title = titleMatch[1]
                .replace(/\\s*-\\s*ラクマ.*/i, '')
                .replace(/\\s*\\|\\s*ラクマ.*/i, '')
                .replace(/通販\\s*by\\s*.*/i, '')
                .trim();
        }

        const priceMatch = html.match(/<meta\\s+property="product:price:amount"\\s+content="([0-9]+)"/i) ||
                           html.match(/"price":\\s*([0-9]+)/) ||
                           html.match(/class="item__price[^"]*">\\s*￥?\\s*([0-9,]+)/i);
        if (priceMatch && priceMatch[1]) {
            price = parseInt(priceMatch[1].replace(/,/g, ''), 10).toLocaleString('ja-JP') + '円';
        }

        if (html.includes('item__badge--soldout') || html.includes('SOLD OUT') || html.includes('売り切れました')) {
            isClosed = true;
        }

        const statusText = isClosed ? '欠品' : '販売中';
        return { title, price, isClosed, statusText };
    } catch (e) {
        return null;
    }
}

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        const req = client.get(targetUrl, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const parsed = new URL(targetUrl);
                    redirectUrl = \`\${parsed.protocol}//\${parsed.host}\${redirectUrl}\`;
                }
                return fetchUrlHtml(redirectUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

function getYahooShoppingItemDataDirect(targetUrl) {
    return fetchUrlHtml(targetUrl).then(html => {
        let title = '';
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i) ||
                           html.match(/<meta[^>]*name=["']title["'][^>]*content=["']([\s\S]*?)["']/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/ - Yahoo!ショッピング.*/i, '').replace(/ : .*/i, '').trim();
        }

        let price = '';
        const priceMatch = html.match(/"price"\s*:\s*"?([0-9]+)"?/i) ||
                           html.match(/class="[^"]*Price[^"]*"[^>]*>\s*([0-9,]+)\s*円/i) ||
                           html.match(/"priceAmount"\s*:\s*"?([0-9]+)"?/i);
        if (priceMatch && priceMatch[1]) {
            const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
            if (!isNaN(p) && p > 0) price = p.toLocaleString('ja-JP') + '円';
        }

        let isClosed = false;
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi);
        if (jsonLdMatches) {
            for (const scriptTag of jsonLdMatches) {
                const jsonText = scriptTag.replace(/<script[^>]*>/i, '').replace(/<\\/script>/i, '').trim();
                if (jsonText.includes('Product') || jsonText.includes('ItemPage') || jsonText.includes('schema.org')) {
                    try {
                        const parsed = JSON.parse(jsonText);
                        const offers = parsed.offers || (parsed['@graph'] && parsed['@graph'].find(o => o.offers)?.offers);
                        if (offers) {
                            const avail = Array.isArray(offers) ? offers[0].availability : offers.availability;
                            if (avail && typeof avail === 'string' && avail.includes('OutOfStock')) {
                                isClosed = true;
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        if (html.includes('id="elItemStatus"') && (html.includes('在庫切れ') || html.includes('販売終了'))) {
            isClosed = true;
        }

        return {
            title: title || '',
            price,
            statusText: isClosed ? '欠品' : '販売中',
            isClosed
        };
    }).catch(e => null);
}

function getMercariItemDataDirect(targetUrl) {
    return fetchUrlHtml(targetUrl).then(html => {
        let title = '';
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/\s*-\s*メルカリ.*/i, '').replace(/by メルカリ.*/i, '').trim();
        }

        let price = '';
        const priceMetaMatch = html.match(/<meta\s+name="product:price:amount"\s+content="([0-9]+)"/i) ||
                               html.match(/"price"\s*:\s*"?([0-9]+)"?/i);
        if (priceMetaMatch && priceMetaMatch[1]) {
            const p = parseInt(priceMetaMatch[1], 10);
            if (!isNaN(p) && p > 0) price = p.toLocaleString('ja-JP') + '円';
        }

        let isClosed = false;
        // ターゲット商品の Schema.org JSON-LD / Status のみを厳格チェック（下部のおすすめ商品テキストには惑わされない）
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi);
        if (jsonLdMatches) {
            for (const scriptTag of jsonLdMatches) {
                const jsonText = scriptTag.replace(/<script[^>]*>/i, '').replace(/<\\/script>/i, '').trim();
                if (jsonText.includes('"Product"') || jsonText.includes('"ItemPage"')) {
                    try {
                        const parsed = JSON.parse(jsonText);
                        const offers = parsed.offers || (parsed.mainEntity && parsed.mainEntity.offers);
                        if (offers) {
                            const avail = Array.isArray(offers) ? offers[0].availability : offers.availability;
                            if (avail && typeof avail === 'string' && avail.includes('OutOfStock')) {
                                isClosed = true;
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        if (html.includes('"status":"ITEM_STATUS_SOLDOUT"') || html.includes('itemStatus":"ITEM_STATUS_SOLDOUT"')) {
            isClosed = true;
        }

        // 価格が取得できており欠品シグナルがない場合は販売中確定
        if (price && !isClosed) {
            return {
                title: title || '',
                price,
                statusText: '販売中',
                isClosed: false
            };
        }

        // 欠品シグナルが確定している場合
        if (isClosed) {
            return {
                title: title || '',
                price: '',
                statusText: '欠品',
                isClosed: true
            };
        }

        // 判定不能な場合はPuppeteerへバトンタッチ
        return null;
    }).catch(e => null);
}

async function getItemDataPuppeteer(browser, url) {
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

        const info = await page.evaluate((targetUrl) => {
            let title = '';
            let price = '';
            let isClosed = false;

            if (targetUrl.includes('amazon.co.jp')) {
                const titleEl = document.querySelector('#productTitle') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : '';
                if (!title || title === 'Amazon.co.jp') {
                    const ogTitle = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="title"]');
                    if (ogTitle && ogTitle.getAttribute('content')) {
                        title = ogTitle.getAttribute('content').replace(/^Amazon\\s*\\|\\s*/i, '').trim();
                    }
                }
                if (!title || title === 'Amazon.co.jp') {
                    title = document.title.replace(/^Amazon\\s*\\|\\s*/i, '').trim();
                }
                if (title === 'Amazon.co.jp') title = '取得エラー';

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
                isClosed = Boolean(availText.includes('一時的に在庫切れ') || availText.includes('現在お取り扱いしておりません') || availText.includes('在庫切れ'));
            } else if (targetUrl.includes('mercari.com') || targetUrl.includes('mercari')) {
                const titleEl = document.querySelector('[data-testid="item-name"]') || document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : '';
                if (!title) {
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle && ogTitle.getAttribute('content')) {
                        title = ogTitle.getAttribute('content').replace(/\\s*-\\s*メルカリ.*/i, '').trim();
                    }
                }
                if (!title || title.includes('日本最大のフリマサービス') || document.title.includes('日本最大のフリマサービス')) {
                    title = '取得エラー';
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

                // 1. JSON-LD Schema.org Check (100% 厳密・誤判定0%)
                let jsonLdStatus = false;
                const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                jsonLdScripts.forEach(script => {
                    try {
                        const json = JSON.parse(script.textContent);
                        const str = JSON.stringify(json);
                        if (str.includes('schema.org/OutOfStock') || str.includes('schema.org/SoldOut') || str.includes('"availability":"OutOfStock"') || str.includes('"availability":"https://schema.org/OutOfStock"')) {
                            jsonLdStatus = true;
                        }
                    } catch (e) {}
                });

                // 2. Next Data Script Check
                let nextDataStatus = false;
                const nextDataScript = document.querySelector('script[id="__NEXT_DATA__"]');
                if (nextDataScript) {
                    try {
                        const nextJson = JSON.parse(nextDataScript.textContent);
                        const itemObj = (nextJson.props && nextJson.props.pageProps && (nextJson.props.pageProps.item || (nextJson.props.pageProps.initialState && nextJson.props.pageProps.initialState.item))) || null;
                        if (itemObj) {
                            if (itemObj.status === 'ITEM_STATUS_SOLDOUT' || itemObj.status === 'ITEM_STATUS_TRADING' || itemObj.isSoldOut === true) {
                                nextDataStatus = true;
                            }
                        }
                    } catch (e) {}
                }

                // 3. DOM Elements & Buttons Check
                const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                const hasSoldoutBtn = allButtons.some(b => {
                    const txt = (b.textContent || '').trim();
                    return txt === '売り切れました' || txt === 'SOLD OUT' || txt === 'この商品は売り切れました';
                });

                const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                                  document.querySelector('div[aria-label*="売り切れ"]');

                isClosed = Boolean(jsonLdStatus || nextDataStatus || hasSoldoutBtn || soldBadge);
            } else if (targetUrl.includes('fril.jp') || targetUrl.includes('rakuma')) {
                const titleEl = document.querySelector('.item__name') ||
                                document.querySelector('[class*="item__name"]') ||
                                document.querySelector('.item-header__name') ||
                                document.querySelector('h1');
                title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\\s*-\\s*ラクマ.*/i, '').trim();

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
                                     document.querySelector('[class*="SOLD"]');
                const purchaseBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('購入に進む'));

                isClosed = Boolean(soldoutBadge || !purchaseBtn);
            } else if (targetUrl.includes('paypayfleamarket') || targetUrl.includes('paypayfleamarket.yahoo.co.jp')) {
                const titleEl = document.querySelector('h1') || document.querySelector('[class*="ItemTitle_title"]') || document.querySelector('[class*="title"]');
                if (titleEl && titleEl.textContent) {
                    title = titleEl.textContent.trim();
                } else {
                    title = document.title
                        .replace(/\\s*-\\s*Yahoo!フリマ.*/i, '')
                        .replace(/\\s*-\\s*PayPayフリマ.*/i, '')
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
                            const match = text.match(/([0-9,]{3,9})\\s*円/);
                            if (match) {
                                price = match[1] + '円';
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }

                const hasPurchaseBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('購入手続きへ'));
                const hasCopyBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('この情報をコピーして出品する'));
                const isSoldBadge = Boolean(document.querySelector('[class*="sold"]') || document.querySelector('[class*="SOLD"]'));

                isClosed = Boolean(isSoldBadge || hasCopyBtn || !hasPurchaseBtn);
            }

            if (!title) title = '取得エラー';
            const statusText = isClosed ? '欠品' : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        await page.close().catch(() => {});
        return info;
    } catch (e) {
        await page.close().catch(() => {});
        // タイムアウトや通信エラー発生時は、安全のため「取得エラー」扱い（＝欠品判定・LINE通知対象）にする
        return { title: '取得エラー', price: '', isClosed: true, statusText: '欠品' };
    }
}

function sendLineNotificationForUser(user, message) {
    return new Promise((resolve) => {
        const token = user.lineChannelAccessToken;
        const userId = user.lineUserId;

        if (!token || !userId) {
            console.log(\`[LINE Notify Sim] (\${user.name}):\\n\${message}\`);
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
                'Authorization': \`Bearer \${token}\`,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            console.log(\`[LINE Response - \${user.name}]: Status \${res.statusCode}\`);
            resolve(res.statusCode === 200);
        });

        req.on('error', (e) => {
            console.error(\`[LINE Error - \${user.name}]:\`, e.message);
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

(async () => {
    console.log('🚀 Starting Enterprise 1000-Row SaaS Sync Engine (Chunked Browser Lifecycle)...');
    const users = loadUsersConfig();
    const activeUsers = users.filter(u => u.spreadsheetId && u.spreadsheetId.trim() !== '');

    if (activeUsers.length === 0) {
        const defaultConfigPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(defaultConfigPath)) {
            try {
                const cfg = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
                if (cfg.spreadsheetId) {
                    activeUsers.push({
                        id: 'default',
                        name: 'デフォルトユーザー',
                        spreadsheetId: cfg.spreadsheetId,
                        lineChannelAccessToken: cfg.lineChannelAccessToken || '',
                        lineUserId: cfg.lineUserId || ''
                    });
                }
            } catch (e) {}
        }
    }

    if (activeUsers.length === 0) {
        console.log('⚠️ No active users found with valid Spreadsheet ID. Exiting.');
        process.exit(0);
    }

    console.log(\`📊 Processing \${activeUsers.length} active users.\`);
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1400,900']
    };
    if (executablePath && fs.existsSync(executablePath)) {
        launchOptions.executablePath = executablePath;
    }

    for (const user of activeUsers) {
        console.log(\`\\n================ Processing User: \${user.name} (\${user.spreadsheetId}) ================\`);
        try {
            // 最大1000行まで取得対象を拡大
            const sheetData = await sheets.spreadsheets.get({
                spreadsheetId: user.spreadsheetId,
                includeGridData: true,
                ranges: ['A1:G1000']
            });

            const rowValues = sheetData.data.sheets[0].data[0].rowData || [];
            console.log(\`User \${user.name}: Found \${rowValues.length} total rows in Spreadsheet.\`);

            let activeRows = [];
            for (let r = 2; r <= Math.min(rowValues.length, 1000); r++) {
                const rowObj = rowValues[r - 1];
                if (!rowObj || !rowObj.values || rowObj.values.length < 2) {
                    console.log(\`Row \${r}: Empty row encountered. Stopping active row collection.\`);
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
                    const match = bCell.userEnteredValue.formulaValue.match(/https?:\\/\\/[^\\s"\'\\)\\,\\;]+/i);
                    if (match) targetUrl = match[0];
                }
                if (!targetUrl) {
                    const jsonStr = JSON.stringify(bCell);
                    const match = jsonStr.match(/https?:\\/\\/[^\\s"\'\\\\]+/i);
                    if (match) targetUrl = match[0];
                }
                if (!targetUrl && bFormatted.startsWith('http')) {
                    targetUrl = bFormatted;
                }

                if (!targetUrl || !targetUrl.includes('http')) {
                    console.log(\`Row \${r}: B column ('\${bFormatted}') is empty. Stopping at row \${r}.\`);
                    break;
                }

                activeRows.push({ r, rowObj, targetUrl });
            }

            console.log(\`User \${user.name}: \${activeRows.length} active rows to process.\`);

            let soldoutAlerts = [];
            let priceAlerts = [];

            // 1000行を20件ずつのチャンクに分割し、毎回ブラウザを完全再起動してメモリリーク・タイムアウトを100%防止
            const CHUNK_SIZE = 20;
            for (let chunkIdx = 0; chunkIdx < activeRows.length; chunkIdx += CHUNK_SIZE) {
                const chunk = activeRows.slice(chunkIdx, chunkIdx + CHUNK_SIZE);
                console.log(\`\\n--- Processing Chunk \${Math.floor(chunkIdx / CHUNK_SIZE) + 1} (\${chunk.length} items, Rows \${chunk[0].r} to \${chunk[chunk.length - 1].r}) ---\`);

                const browser = await puppeteer.launch(launchOptions);

                for (const item of chunk) {
                    const { r, rowObj, targetUrl, bFormatted } = item;
                    console.log(\`User \${user.name} - Processing Row \${r} URL:\`, targetUrl);

                    let itemData = null;

                    if (targetUrl.includes('auctions.yahoo.co.jp')) {
                        itemData = await getYahooItemData(targetUrl);
                    } else if (targetUrl.includes('shopping.yahoo.co.jp')) {
                        itemData = await getYahooShoppingItemDataDirect(targetUrl);
                    } else if (targetUrl.includes('fril.jp') || targetUrl.includes('rakuma')) {
                        itemData = await getRakumaItemDataDirect(targetUrl);
                    } else if (targetUrl.includes('mercari.com') || targetUrl.includes('mercari')) {
                        itemData = await getMercariItemDataDirect(targetUrl);
                    }

                    if (!itemData || !itemData.title || itemData.title === '取得エラー') {
                        itemData = await getItemDataPuppeteer(browser, targetUrl);
                    }

                    const cCell = rowObj.values[2] || {};
                    const dCell = rowObj.values[3] || {};
                    const eCell = rowObj.values[4] || {};
                    const currentCValue = (cCell.formattedValue || '').trim();
                    const currentDValue = (dCell.formattedValue || '').trim();
                    const currentEValue = (eCell.formattedValue || '').trim();

                    // C列が過去の誤動作で「欠品」「取得エラー」「Amazon.co.jp」になっている場合、復元・清掃する
                    const isCorruptedC = (currentCValue === '欠品' || currentCValue === '取得エラー' || currentCValue === 'Amazon.co.jp');

                    let realTitle = '';
                    if (itemData.title && itemData.title !== '取得エラー' && itemData.title !== 'Amazon.co.jp' && itemData.title !== '欠品') {
                        realTitle = itemData.title;
                    } else if (!isCorruptedC && currentCValue) {
                        realTitle = currentCValue;
                    } else if (bFormatted && !bFormatted.startsWith('http')) {
                        realTitle = bFormatted.replace(/\s*-\s*メルカリ.*/i, '').replace(/\s*-\s*ラクマ.*/i, '').trim();
                    } else {
                        realTitle = currentCValue || '商品';
                    }

                    let newTitle = realTitle;
                    let newD = '';
                    let newE = currentEValue;
                    let newF = '';

                    const isItemUnavailable = (itemData.statusText === '欠品') || itemData.isClosed || (!itemData.title) || (itemData.title === '取得エラー') || (itemData.title === 'Amazon.co.jp');

                    if (itemData.statusText === 'エラー') {
                        newD = currentDValue;
                        newE = (currentEValue && currentEValue === currentDValue) ? '' : currentEValue;
                        newF = 'エラー';
                    } else if (isItemUnavailable) {
                        newTitle = realTitle;
                        newD = currentDValue;
                        newE = (currentEValue && currentEValue === currentDValue) ? '' : currentEValue;
                        newF = '欠品';
                        soldoutAlerts.push(\`・行\${r}: \${newTitle} (URL: \${targetUrl})\`);
                    } else {
                        newTitle = realTitle;
                        if (!itemData.price) {
                            newD = currentDValue;
                            newE = (currentEValue && currentEValue === currentDValue) ? '' : currentEValue;
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
                                    priceAlerts.push(\`・行\${r}: \${newTitle}\\n  旧価格: \${currentDValue} ➔ 新価格: \${itemData.price}\`);
                                } else {
                                    newF = '↓下げ';
                                    priceAlerts.push(\`・行\${r}: \${newTitle}\\n  旧価格: \${currentDValue} ➔ 新価格: \${itemData.price}\`);
                                }
                            } else {
                                newD = currentDValue;
                                // もし旧価格E列に誤ってD列と同じ数値が入っている場合は空欄にクリーンアップし、本物の旧価格または空欄を維持
                                newE = (currentEValue && currentEValue === currentDValue) ? '' : currentEValue;
                                newF = '販売中';
                            }
                        }
                    }

                    console.log(\`User \${user.name} - Row \${r} Update C\${r}:F\${r} ->\`, [newTitle, newD, newE, newF]);
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: user.spreadsheetId,
                        range: \`C\${r}:F\${r}\`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [[ newTitle, newD, newE, newF ]]
                        }
                    });
                }

                await browser.close().catch(() => {});
            }

            if (soldoutAlerts.length > 0 || priceAlerts.length > 0) {
                let notifyMsg = \`【商管どん 自動同期アラート (\${user.name})】\\n\`;
                if (soldoutAlerts.length > 0) {
                    notifyMsg += \`\\n🚨 欠品検知 (\${soldoutAlerts.length}件):\\n\` + soldoutAlerts.join('\\n') + '\\n';
                }
                if (priceAlerts.length > 0) {
                    notifyMsg += \`\\n📈 値上げ検知 (\${priceAlerts.length}件):\\n\` + priceAlerts.join('\\n') + '\\n';
                }
                console.log(\`\\n📲 Sending LINE Notification to \${user.name}...\`);
                await sendLineNotificationForUser(user, notifyMsg);
            }

        } catch (uErr) {
            console.error(\`User \${user.name} Sync Error:\`, uErr.message);
        }
    }

    console.log('✅ All SaaS Users Auto-Sync (1000-Row Scale) completed successfully!');
    process.exit(0);
})();
`;

fs.writeFileSync('saas_batch_engine_server.js', content, 'utf8');
console.log('Wrote 1000-row enterprise saas_batch_engine_server.js cleanly');
