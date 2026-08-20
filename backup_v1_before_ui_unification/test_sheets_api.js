const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function testSheets() {
    try {
        const keyPath = path.join(__dirname, 'google_service_account.json');
        if (!fs.existsSync(keyPath)) {
            console.error('Key file not found!');
            return;
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4';

        const res = await sheets.spreadsheets.get({
            spreadsheetId,
            includeGridData: true,
            ranges: ['A1:G10']
        });

        console.log('Successfully connected to Spreadsheet!');
        console.log('Title:', res.data.properties.title);

        const rowData = res.data.sheets[0].data[0].rowData || [];
        rowData.forEach((row, idx) => {
            const cells = row.values || [];
            console.log(`Row ${idx + 1}:`);
            cells.forEach((c, cIdx) => {
                const colName = String.fromCharCode(65 + cIdx);
                const val = c.formattedValue || '';
                const link = c.hyperlink || (c.userEnteredValue && c.userEnteredValue.formulaValue) || '';
                console.log(`  Col ${colName}: val="${val}", link="${link}"`);
            });
        });
    } catch (err) {
        console.error('Error connecting to Sheets API:', err.message);
        if (err.message.includes('404')) {
            console.error('Spreadsheet not found or service account does not have access.');
        }
    }
}

testSheets();
