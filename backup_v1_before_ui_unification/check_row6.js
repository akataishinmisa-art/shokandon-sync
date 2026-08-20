const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SPREADSHEET_ID = '15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4';

function getGoogleAuth() {
    const keyPath = path.join(__dirname, 'google_service_account.json');
    return new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function checkRow6() {
    try {
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const sheetData = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            includeGridData: true,
            ranges: ['A1:G20']
        });

        const rowValues = sheetData.data.sheets[0].data[0].rowData || [];
        console.log(`Total Rows fetched: ${rowValues.length}`);

        rowValues.forEach((row, idx) => {
            const rowNum = idx + 1;
            const bCell = (row.values && row.values[1]) || {};
            console.log(`\n--- Row ${rowNum} ---`);
            console.log(`FormattedValue:`, bCell.formattedValue);
            console.log(`Hyperlink:`, bCell.hyperlink);
            console.log(`FormulaValue:`, bCell.userEnteredValue ? bCell.userEnteredValue.formulaValue : undefined);
            console.log(`TextFormatRuns:`, JSON.stringify(bCell.textFormatRuns));
            
            const jsonStr = JSON.stringify(bCell);
            const match = jsonStr.match(/https?:\/\/[^\s"'\\]+/i);
            console.log(`Extracted URL via JSON search:`, match ? match[0] : 'NONE');
        });
    } catch (err) {
        console.error('Error fetching sheet:', err.message);
    }
}

checkRow6();
