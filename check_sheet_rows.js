const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'google_service_account.json');
const configPath = path.join(__dirname, 'config.json');

const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

(async () => {
    const res = await sheets.spreadsheets.get({
        spreadsheetId: '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4',
        includeGridData: true,
        ranges: ['A1:F50']
    });

    const rows = res.data.sheets[0].data[0].rowData || [];
    console.log(`Total rows in grid data: ${rows.length}`);

    rows.forEach((row, i) => {
        const rowNum = i + 1;
        if (row.values && rowNum >= 2 && rowNum <= 33) {
            const a = row.values[0] ? (row.values[0].formattedValue || '') : '';
            const b = row.values[1] ? (row.values[1].formattedValue || '') : '';
            const c = row.values[2] ? (row.values[2].formattedValue || '') : '';
            const d = row.values[3] ? (row.values[3].formattedValue || '') : '';
            const e = row.values[4] ? (row.values[4].formattedValue || '') : '';
            const f = row.values[5] ? (row.values[5].formattedValue || '') : '';
            console.log(`Row ${rowNum}: A=[${a}] B=[${b}] C=[${c}] D=[${d}] E=[${e}] F=[${f}]`);
        }
    });
})();
