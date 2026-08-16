const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const USERS_CONFIG_PATH = path.join(__dirname, 'users_config.json');
const users = JSON.parse(fs.readFileSync(USERS_CONFIG_PATH, 'utf8'));
const user = users[0];

const keyPath = path.join(__dirname, 'google_service_account.json');
const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

(async () => {
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = user.spreadsheetId;

    const res = await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: ['A28:G30'],
        includeGridData: true
    });

    const rowData = res.data.sheets[0].data[0].rowData;
    for (let i = 0; i < rowData.length; i++) {
        console.log(`--- Row ${i + 28} ---`);
        console.log(JSON.stringify(rowData[i].values[1], null, 2));
    }
})();
