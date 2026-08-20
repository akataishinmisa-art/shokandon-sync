const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4';

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
    throw new Error('Credentials not found');
}

(async () => {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: ['A1:F45']
    });

    const rowData = res.data.sheets[0].data[0].rowData || [];
    console.log('Row | C (Title) | D (New Price) | E (Old Price) | F (Status)');
    console.log('------------------------------------------------------------');
    for (let i = 1; i < rowData.length; i++) {
        const vals = rowData[i].values || [];
        const c = vals[2] ? vals[2].formattedValue || '' : '';
        const d = vals[3] ? vals[3].formattedValue || '' : '';
        const e = vals[4] ? vals[4].formattedValue || '' : '';
        const f = vals[5] ? vals[5].formattedValue || '' : '';
        console.log(`Row ${i+1}: D="${d}" | E="${e}" | F="${f}" | C="${c.substring(0, 20)}"`);
    }
})();
