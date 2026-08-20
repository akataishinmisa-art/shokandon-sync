const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4';

function getGoogleAuth() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    const keyPath = path.join(__dirname, 'google_service_account.json');
    if (fs.existsSync(keyPath)) {
        return new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    throw new Error('Credentials not found');
}

(async () => {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: ['A1:F50']
    });

    const rowData = res.data.sheets[0].data[0].rowData || [];
    console.log(`Checking ${rowData.length} rows for duplicate D/E values...`);

    let cleanedCount = 0;

    for (let i = 1; i < rowData.length; i++) {
        const rowNum = i + 1;
        const vals = rowData[i].values || [];
        const c = vals[2] ? vals[2].formattedValue || '' : '';
        const d = vals[3] ? vals[3].formattedValue || '' : '';
        const e = vals[4] ? vals[4].formattedValue || '' : '';
        const f = vals[5] ? vals[5].formattedValue || '' : '';

        if (!d) continue;

        // If D and E are identical, E is a false duplicate from previous runs -> clear E
        if (d && e && d.trim() === e.trim()) {
            console.log(`Row ${rowNum}: Clearing duplicate E column value '${e}' (matches D='${d}')`);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `E${rowNum}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['']] }
            });
            cleanedCount++;
        }
    }

    console.log(`\n✅ Finished cleanup! Cleared duplicate E column values in ${cleanedCount} rows.`);
})();
