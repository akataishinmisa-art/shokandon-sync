const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google_service_account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

(async () => {
    const sheets = google.sheets({ version: 'v4', auth });
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users_config.json'), 'utf8'));
    const spreadsheetId = users[0].spreadsheetId;

    const res = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: true,
        ranges: ['A1:G60']
    });

    const rowValues = res.data.sheets[0].data[0].rowData || [];
    console.log("=== Row Values in Google Sheet (Rows 1 to 55) ===");
    for (let r = 2; r <= Math.min(rowValues.length, 55); r++) {
        const rowObj = rowValues[r - 1];
        const b = rowObj.values[1]?.formattedValue || '';
        const c = rowObj.values[2]?.formattedValue || '';
        const d = rowObj.values[3]?.formattedValue || '';
        const e = rowObj.values[4]?.formattedValue || '';
        const f = rowObj.values[5]?.formattedValue || '(BLANK)';
        console.log(`Row ${r.toString().padStart(2, ' ')}: F=[${f}] | D=[${d}] | C=[${c.substring(0, 20)}]`);
    }
})();
