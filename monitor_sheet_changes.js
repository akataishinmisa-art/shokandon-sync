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

(async () => {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('1. Clearing E2 and E3 in Google Sheets...');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'E2:E3',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[''], ['']] }
    });
    console.log('Cleared E2 and E3.');

    console.log('2. Monitoring E2 and E3 for 60 seconds (checking every 3 seconds)...');
    for (let i = 1; i <= 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'D2:E3'
        });
        const rows = res.data.values || [];
        const e2 = rows[0] && rows[0][1] ? rows[0][1] : '(empty)';
        const e3 = rows[1] && rows[1][1] ? rows[1][1] : '(empty)';
        console.log(`[Check ${i}/20 at ${new Date().toLocaleTimeString()}]: Row 2 E="${e2}", Row 3 E="${e3}"`);
        if (e2 !== '(empty)' || e3 !== '(empty)') {
            console.log('ALERT! E column was changed by an external source!');
            break;
        }
    }
})();
