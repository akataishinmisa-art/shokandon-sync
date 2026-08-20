const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

(async () => {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'google_service_account.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users_config.json'), 'utf8'));
    const spreadsheetId = users[0].spreadsheetId;

    // Row 28〜40 のうち、以前の誤作動で入ってしまったE列の値をクリア（Row 32等の本物は残す）
    // ユーザー様のスプレッドシートに合わせて、Row 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40 の E列を空欄に戻す
    const rowsToClearE = [28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40];
    for (const r of rowsToClearE) {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `E${r}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['']] }
        });
    }
    console.log('Cleaned misplaced E column values successfully!');
})();
