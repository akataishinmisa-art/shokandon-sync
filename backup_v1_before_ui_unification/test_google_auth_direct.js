const { google } = require('googleapis');
const path = require('path');

(async () => {
    try {
        console.log("Testing Google Auth...");
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, 'google_service_account.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const token = await client.getAccessToken();
        console.log("SUCCESS! Token fetched:", token ? "OK" : "NONE");
    } catch (e) {
        console.error("ERROR FETCHING TOKEN:", e.message);
    }
})();
