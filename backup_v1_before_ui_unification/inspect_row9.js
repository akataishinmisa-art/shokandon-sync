const { google } = require('googleapis');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4';

function getGoogleAuth() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    }
    const keyPath = path.join(__dirname, 'google_service_account.json');
    return new google.auth.GoogleAuth({ keyFile: keyPath, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

function getExecutablePath() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

(async () => {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: ['A9:G9']
    });

    const rowData = res.data.sheets[0].data[0].rowData || [];
    const rowObj = rowData[0];
    const bCell = rowObj.values[1] || {};
    let targetUrl = bCell.hyperlink || '';
    if (!targetUrl && bCell.textFormatRuns) {
        for (const run of bCell.textFormatRuns) {
            if (run.format && run.format.link && run.format.link.uri) { targetUrl = run.format.link.uri; break; }
        }
    }
    if (!targetUrl && bCell.formattedValue) {
        const match = bCell.formattedValue.match(/https?:\/\/[^\s"'\)\,\;]+/i);
        if (match) targetUrl = match[0];
    }

    console.log(`Row 9 URL: ${targetUrl}`);
    
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(res => setTimeout(res, 2500)));

    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, 'row9_mercari.html'), html);
    console.log(`Saved row9_mercari.html (${html.length} bytes)`);

    const result = await page.evaluate(() => {
        const titleEl = document.querySelector('h1') || document.querySelector('[data-testid="item-name"]');
        const title = titleEl ? titleEl.textContent.trim() : '';

        const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
        let price = metaPrice ? metaPrice.getAttribute('content') : '';

        const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') || document.querySelector('div[aria-label*="売り切れ"]');
        const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
        const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';

        const bodyText = document.body.innerText || '';
        const isSoldText = bodyText.includes('売り切れました') || bodyText.includes('SOLD OUT') || bodyText.includes('公開が停止') || bodyText.includes('掲載が終了');

        return {
            title,
            price,
            soldBadge: Boolean(soldBadge),
            checkoutBtnFound: Boolean(checkoutBtn),
            checkoutBtnText: btnText,
            isSoldText,
            bodyLength: bodyText.length
        };
    });

    console.log('Evaluated result:', result);
    await browser.close();
})();
