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

    // Update Row 29 B29 hyperlink and C29:F29 values
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'B29:F29',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [
                [
                    'https://store.shopping.yahoo.co.jp/senrakuen/e580.html',
                    'ThinkPad Lenovo　最新Win11Pro頑丈軽量高性能ノートパソコンThinkPad X280/12.5型フルHD/Core第8世代i5/メモリ8GB/高速M.2SSD/Bluetooth/内蔵カメラ/MSoffice2021/WIFI',
                    '29,800円',
                    '29,800円',
                    '販売中'
                ]
            ]
        }
    });

    console.log('Row 29 updated successfully with clean Yahoo! Shopping data!');
})();
