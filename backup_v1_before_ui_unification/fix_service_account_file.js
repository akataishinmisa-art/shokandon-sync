const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const filePath = path.join(__dirname, 'google_service_account.json');
let content = fs.readFileSync(filePath, 'utf8');

// Parse JSON
const json = JSON.parse(content);

// Convert escaped \n in private_key to real ASCII newlines (\n)
if (json.private_key && json.private_key.includes('\\n')) {
    console.log("Fixing escaped \\n in private_key...");
    json.private_key = json.private_key.replace(/\\n/g, '\n');
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    console.log("google_service_account.json file fixed!");
} else {
    console.log("private_key already uses real newlines or no escaped \\n found.");
}

// Now test Google Auth with the fixed file
(async () => {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: filePath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        console.log("🎉 [SUCCESSFUL AUTH RECOVERY] Token fetched successfully:", token ? "OK" : "NONE");
    } catch (e) {
        console.error("❌ Auth test result:", e.message);
    }
})();
