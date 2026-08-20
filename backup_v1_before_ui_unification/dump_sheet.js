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

    const res = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: true,
        ranges: ['A1:J60']
    });

    const rowData = res.data.sheets[0].data[0].rowData || [];
    for (let i = 0; i < Math.min(rowData.length, 60); i++) {
        const row = rowData[i];
        const rowNum = i + 1;
        const vals = (row.values || []).map(v => (v && v.formattedValue) ? v.formattedValue : '');
        console.log(`Row ${rowNum.toString().padStart(2, ' ')}: B=[${vals[1] || ''}] | C=[${(vals[2] || '').substring(0, 15)}] | D=[${vals[3] || ''}] | E=[${vals[4] || ''}] | F=[${vals[5] || ''}] | G=[${(vals[6] || '').substring(0, 15)}]`);
    }
})();
