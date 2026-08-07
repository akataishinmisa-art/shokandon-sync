const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { google } = require('googleapis');

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

async function getItemDataHttp(url) {
    let title = '';
    let price = '';
    let isClosed = false;

    try {
        const html = await fetchHtml(url);

        if (url.includes('auctions.yahoo.co.jp')) {
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
        } else if (url.includes('mercari.com')) {
            const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>(.*?)<\/title>/i);
            title = ogTitleMatch ? ogTitleMatch[1].replace(' - メルカリ', '').trim() : '';

            const priceMatch = html.match(/<meta\s+(?:name|property)="product:price:amount"\s+content="([0-9]+)"/i) || html.match(/"price"\s*:\s*([0-9]+)/i);
            if (priceMatch && priceMatch[1]) {
                const pVal = parseInt(priceMatch[1], 10);
                if (!isNaN(pVal) && pVal > 0) {
                    price = pVal.toLocaleString('ja-JP') + '円';
                }
            }
            isClosed = html.includes('"isSoldOut":true') || html.includes('ITEM_STATUS_SOLDOUT') || html.includes('売り切れ');
        } else if (url.includes('paypayfleamarket') || url.includes('paypayfleamarket.yahoo.co.jp')) {
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            title = titleMatch ? titleMatch[1].replace(/\s*-\s*Yahoo!フリマ.*/i, '').replace(/\s*-\s*PayPayフリマ.*/i, '').trim() : '';

            const priceMatch = html.match(/<meta\s+(?:name|property)="product:price:amount"\s+content="([0-9]+)"/i) || html.match(/"price"\s*:\s*([0-9]+)/i);
            if (priceMatch && priceMatch[1]) {
                const pVal = parseInt(priceMatch[1], 10);
                if (!isNaN(pVal) && pVal > 0) {
                    price = pVal.toLocaleString('ja-JP') + '円';
                }
            }
            isClosed = html.includes('売り切れました') || html.includes('SOLD OUT') || html.includes('公開が停止') || html.includes('掲載が終了');
        } else if (url.includes('amazon.co.jp')) {
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            title = titleMatch ? titleMatch[1].replace(/^Amazon\s*\|\s*/i, '').trim() : '';

            const priceMatch = html.match(/class="a-price-whole">([0-9,]+)/i) || html.match(/￥\s*([0-9,]+)/);
            if (priceMatch && priceMatch[1]) {
                price = priceMatch[1].replace(/,/g, '').replace(/[^0-9]/g, '');
                if (price) price = parseInt(price, 10).toLocaleString('ja-JP') + '円';
            }
            isClosed = html.includes('一時的に在庫切れ') || html.includes('現在お取り扱いしておりません') || html.includes('在庫切れ');
        } else {
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            title = titleMatch ? titleMatch[1].trim() : '';
            const priceMatch = html.match(/([0-9,]{3,9})\s*円/);
            if (priceMatch && priceMatch[1]) {
                price = priceMatch[1] + '円';
            }
        }
    } catch (e) {
        console.error('HTTP fetch error for', url, e.message);
    }

    const statusText = isClosed ? '欠品' : '販売中';
    return { title: title || '商品情報取得中', price: price || '', isClosed, statusText };
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
    console.log('⚡ Running pure HTTP fast-sync mode (no heavy browser required)...');

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
        if (!targetUrl && bCell.userEnteredValue && bCell.userEnteredValue.formulaValue) {
            const match = bCell.userEnteredValue.formulaValue.match(/HYPERLINK\("([^"]+)"/i);
            if (match) targetUrl = match[1];
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

        const itemData = await getItemDataHttp(targetUrl);
        console.log(`Row ${r} Item Data:`, { title: itemData.title, price: itemData.price, isClosed: itemData.isClosed, statusText: itemData.statusText });

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
                newD = itemData.price || currentDValue;
                const numD = parseNum(newD);
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

    if (missingItemsList.length > 0) {
        console.log(`\n================ Sending Batch LINE Notification ================`);
        let lineBatchMsg = '';
        for (const item of missingItemsList) {
            lineBatchMsg += `要出品取り消し\n${item.bUrl}\n${item.gUrl}\n\n`;
        }
        lineBatchMsg = lineBatchMsg.trim();
        console.log(`Batch LINE Message Content:\n${lineBatchMsg}`);
        await sendLineNotification(lineBatchMsg);
    } else {
        console.log('No missing items found. No LINE notification sent.');
    }

    console.log('✅ Fast HTTP Auto-sync via Google Sheets API completed successfully!');
    process.exit(0);
})();
