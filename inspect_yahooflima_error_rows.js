const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

function getExecutablePath() {
    if (process.platform === 'linux') return '/usr/bin/chromium';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}
const executablePath = getExecutablePath();

function getGoogleAuth() {
    const keyPath = path.join(__dirname, 'google_service_account.json');
    return new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

(async () => {
    try {
        console.log("=== 🔍 Inspecting Rows 32, 50, 52 from Google Sheets ===");
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users_config.json'), 'utf8'));
        const spreadsheetId = users[0].spreadsheetId;

        const res = await sheets.spreadsheets.get({
            spreadsheetId,
            includeGridData: true,
            ranges: ['A1:G60']
        });

        const rowValues = res.data.sheets[0].data[0].rowData || [];
        const targetRowNumbers = [32, 50, 52];

        const targetUrls = [];
        for (const rowNum of targetRowNumbers) {
            const rowObj = rowValues[rowNum - 1];
            const bCell = (rowObj && rowObj.values && rowObj.values.length > 1) ? rowObj.values[1] : null;
            let targetUrl = bCell ? (bCell.hyperlink || (bCell.userEnteredValue && bCell.userEnteredValue.formulaValue) || bCell.formattedValue || '') : '';
            if (targetUrl && targetUrl.includes('http')) {
                const match = targetUrl.match(/https?:\/\/[^\s"'\)\,\;]+/i);
                if (match) targetUrl = match[0];
            }
            console.log(`Row ${rowNum}: B URL = ${targetUrl} | C = ${rowObj.values[2]?.formattedValue} | D = ${rowObj.values[3]?.formattedValue} | E = ${rowObj.values[4]?.formattedValue} | F = ${rowObj.values[5]?.formattedValue}`);
            targetUrls.push({ rowNum, targetUrl });
        }

        const browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        for (const item of targetUrls) {
            console.log(`\n---------------- Testing Row ${item.rowNum}: ${item.targetUrl} ----------------`);
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.goto(item.targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

            const html = await page.content();
            fs.writeFileSync(`row_${item.rowNum}_yahooflima.html`, html, 'utf8');

            const domCheck = await page.evaluate(() => {
                const bodyText = document.body.innerText || '';
                const allButtons = Array.from(document.querySelectorAll('button, a')).map(el => el.textContent.trim()).filter(t => t.length > 0);
                const hasBuyBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('購入手続きへ'));
                const hasCopyBtn = Array.from(document.querySelectorAll('button, a')).some(el => el.textContent.includes('この情報をコピーして出品する'));
                const titleEl = document.querySelector('h1') || document.querySelector('[class*="ItemTitle_title"]') || document.querySelector('[class*="itemTitle"]');
                const priceEl = document.querySelector('[class*="Price_value"]') || document.querySelector('[class*="price"]') || document.querySelector('meta[name="product:price:amount"]');

                return {
                    title: titleEl ? titleEl.textContent.trim() : 'NO TITLE',
                    price: priceEl ? (priceEl.content || priceEl.textContent.trim()) : 'NO PRICE',
                    hasBuyBtn,
                    hasCopyBtn,
                    firstFewButtons: allButtons.slice(0, 15),
                    hasSoldText: bodyText.includes('で売れました') || bodyText.includes('売り切れました') || bodyText.includes('この商品は存在しません')
                };
            });

            console.log(`Row ${item.rowNum} DOM Check:`, domCheck);
            await page.close();
        }

        await browser.close();
    } catch (e) {
        console.error("INSPECTION ERROR:", e.message);
    }
})();
