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
        ranges: ['A1:G45']
    });

    const rowData = res.data.sheets[0].data[0].rowData || [];
    const rowsToCheck = [13, 15, 43];

    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    for (const r of rowsToCheck) {
        const rowObj = rowData[r - 1];
        if (!rowObj || !rowObj.values) continue;
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

        console.log(`\n--- Inspecting Row ${r} ---`);
        console.log(`URL: ${targetUrl}`);
        const cVal = rowObj.values[2] ? rowObj.values[2].formattedValue : '';
        const dVal = rowObj.values[3] ? rowObj.values[3].formattedValue : '';
        const eVal = rowObj.values[4] ? rowObj.values[4].formattedValue : '';
        const fVal = rowObj.values[5] ? rowObj.values[5].formattedValue : '';
        console.log(`Sheet Values: C="${cVal}", D="${dVal}", E="${eVal}", F="${fVal}"`);

        if (targetUrl) {
            const page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 900 });
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.evaluate(() => new Promise(res => setTimeout(res, 2500)));
            const html = await page.content();

            const checkResult = await page.evaluate((url) => {
                let isClosed = false;
                let title = '';
                let price = '';
                if (url.includes('mercari')) {
                    const titleEl = document.querySelector('h1') || document.querySelector('[data-testid="item-name"]');
                    title = titleEl ? titleEl.textContent.trim() : '';
                    const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') || document.querySelector('div[aria-label*="売り切れ"]');
                    const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
                    const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';
                    isClosed = Boolean(soldBadge || (checkoutBtn && checkoutBtn.disabled && btnText.includes('売り切れ')));
                }
                return { title, isClosed };
            }, targetUrl);

            console.log(`Scrape Result: Title="${checkResult.title}", isClosed=${checkResult.isClosed}`);
            await page.close();
        }
    }

    await browser.close();
})();
