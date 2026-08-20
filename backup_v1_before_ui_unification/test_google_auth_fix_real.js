const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        console.log("=== Testing Real Fix for Google Service Account Auth ===");
        const keyPath = path.join(__dirname, 'google_service_account.json');
        const keyRaw = fs.readFileSync(keyPath, 'utf8');
        const credentials = JSON.parse(keyRaw);

        // Fix private_key newlines explicitly
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const token = await client.getAccessToken();
        console.log("🎉 SUCCESS! Google Auth Token Fetched Successfully:", token ? "OK" : "NONE");
    } catch (e) {
        console.error("❌ STILL ERROR:", e.message);
    }
})();
