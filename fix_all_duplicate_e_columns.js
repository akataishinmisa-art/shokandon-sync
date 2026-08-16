const { google } = require('googleapis');
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

function parseNum(val) {
    if (!val) return null;
    const cleaned = val.toString().replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : null;
}

(async () => {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Fetching all rows from A1:G500 to perform thorough E column cleanup...');
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A1:G500'
    });

    const rows = response.data.values || [];
    console.log(`Total rows fetched: ${rows.length}`);

    let clearedCount = 0;
    const batchUpdates = [];

    for (let r = 2; r <= rows.length; r++) {
        const row = rows[r - 1] || [];
        const dVal = (row[3] || '').trim(); // D列 (新価格)
        const eVal = (row[4] || '').trim(); // E列 (旧価格)

        const numD = parseNum(dVal);
        const numE = parseNum(eVal);

        // もしD列とE列の両方に数値が入っており、かつ数値が同一（例: D="4,500円", E="4,500円"）の場合は、
        // 過去の自動書き込みで誤って上書きされた重複データと断定し、E列を空欄に消去・修正する
        if (numD !== null && numE !== null && numD === numE) {
            console.log(`Row ${r}: Clearing duplicate E column '${eVal}' -> '' (D is '${dVal}')`);
            batchUpdates.push({
                range: `E${r}`,
                values: [['']]
            });
            clearedCount++;
        }
    }

    if (batchUpdates.length > 0) {
        console.log(`Executing batch update for ${batchUpdates.length} rows...`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: batchUpdates
            }
        });
        console.log(`✅ Successfully cleared ${clearedCount} rows with duplicate E values in Google Sheets!`);
    } else {
        console.log('No duplicate E values found to clear.');
    }
})();
