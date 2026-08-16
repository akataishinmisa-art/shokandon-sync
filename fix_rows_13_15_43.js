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
    
    // Update Row 13, Row 15, and Row 43 to 欠品
    const targetRows = [13, 15, 43];
    
    for (const r of targetRows) {
        console.log(`Updating Row ${r} to 欠品...`);
        // Get existing row data first
        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true,
            ranges: [`A${r}:F${r}`]
        });
        const vals = res.data.sheets[0].data[0].rowData[0].values || [];
        const currentD = vals[3] ? vals[3].formattedValue || '' : '';
        const currentE = vals[4] ? vals[4].formattedValue || '' : '';
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `C${r}:F${r}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['欠品', currentD, currentE, '欠品']]
            }
        });
    }

    console.log('✅ Successfully updated Rows 13, 15, 43 to 欠品 in Google Sheets!');
})();
