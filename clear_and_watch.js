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

    console.log('1. Clearing E2:E5 in Google Sheets...');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'E2:E5',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[''], [''], [''], ['']] }
    });
    console.log('Cleared E2:E5.');

    console.log('2. Monitoring E2:E5 for 30 seconds (checking every 2 seconds)...');
    for (let i = 1; i <= 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'D2:E5'
        });
        const rows = res.data.values || [];
        const vals = rows.map((r, idx) => `Row ${idx+2}: D="${r[0]}", E="${r[1] || ''}"`).join(' | ');
        console.log(`[Check ${i} at ${new Date().toLocaleTimeString()}]: ${vals}`);
        const hasOverwrittenE = rows.some(r => r[1] && r[1].trim() !== '');
        if (hasOverwrittenE) {
            console.log('⚠️ ALERT! External process or formula just overwrote E column!');
            break;
        }
    }
})();
