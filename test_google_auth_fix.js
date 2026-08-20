const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        console.log("Testing Fixed Google Auth...");
        const keyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'google_service_account.json'), 'utf8'));
        
        // Ensure private key handles newlines properly
        if (keyData.private_key) {
            keyData.private_key = keyData.private_key.replace(/\\n/g, '\n');
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: keyData.client_email,
                private_key: keyData.private_key
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const token = await client.getAccessToken();
        console.log("SUCCESS! Token fetched:", token ? "OK" : "NONE");
    } catch (e) {
        console.error("ERROR FETCHING TOKEN:", e.message);
    }
})();
