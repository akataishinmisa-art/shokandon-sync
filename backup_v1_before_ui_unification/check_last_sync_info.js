const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

(async () => {
    const keyPath = path.join(__dirname, 'google_service_account.json');
    const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users_config.json'), 'utf8'));

    console.log('User status info:', users[0].lastSyncTime, users[0].lastStatus);
})();
