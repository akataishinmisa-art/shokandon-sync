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

    console.log('Cleaning up duplicate old prices (where E column equals D column)...');
    const sheetData = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: ['A1:G200']
    });

    const rowValues = sheetData.data.sheets[0].data[0].rowData || [];
    let cleanedCount = 0;

    for (let r = 2; r <= rowValues.length; r++) {
        const rowObj = rowValues[r - 1];
        if (!rowObj || !rowObj.values || rowObj.values.length < 5) continue;

        const dCell = rowObj.values[3] || {};
        const eCell = rowObj.values[4] || {};
        const dVal = (dCell.formattedValue || '').trim();
        const eVal = (eCell.formattedValue || '').trim();

        // If E column has the exact same value as D column (erroneous duplicate), clean E column back to empty
        if (dVal && eVal && dVal === eVal) {
            console.log(`Row ${r}: Cleaning duplicate E column '${eVal}' -> '' (D column is '${dVal}')`);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `E${r}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['']] }
            });
            cleanedCount++;
        }
    }

    console.log(`✅ Cleaned up ${cleanedCount} rows with duplicate E values in Google Sheets!`);
})();
