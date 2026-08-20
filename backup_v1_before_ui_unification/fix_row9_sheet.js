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

    console.log('Restoring Row 9 to valid available state...');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'C9:F9',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [['ハローキティ ご当地根付 ストラップ 13個セット', '6,000円', '', '販売中']]
        }
    });

    console.log('✅ Row 9 restored to 販売中 (6,000円) in Google Sheets!');
})();
