const fs = require('fs');
const path = require('path');
const os = require('os');
const { google } = require('googleapis');

(async () => {
    console.log("=== 🔍 Monitoring for NEWLY generated Google Service Account Key ===");
    
    const downloadsFolder = path.join(os.homedir(), 'Downloads');
    const targetFolder = __dirname;
    const destPath = path.join(targetFolder, 'google_service_account.json');

    if (!fs.existsSync(downloadsFolder)) return;

    // Filter files created/modified in the last 10 minutes
    const now = Date.now();
    const files = fs.readdirSync(downloadsFolder);
    const jsonFiles = files.filter(f => {
        if (!f.endsWith('.json')) return false;
        const fullPath = path.join(downloadsFolder, f);
        const stats = fs.statSync(fullPath);
        // Only accept keys downloaded within the last 10 minutes (after 12:00)
        return (now - stats.mtimeMs) < (10 * 60 * 1000);
    });

    let newestFile = null;
    let newestTime = 0;

    for (const f of jsonFiles) {
        const fullPath = path.join(downloadsFolder, f);
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs > newestTime) {
            newestTime = stats.mtimeMs;
            newestFile = fullPath;
        }
    }

    if (newestFile) {
        console.log(`✨ Found freshly downloaded key: ${newestFile}`);
        fs.copyFileSync(newestFile, destPath);
        console.log(`✅ Successfully updated ${destPath}`);

        try {
            console.log("Testing Authentication with NEW KEY...");
            const auth = new google.auth.GoogleAuth({
                keyFile: destPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const client = await auth.getClient();
            const token = await client.getAccessToken();
            if (token) {
                console.log("\n🎉🎉🎉 [AUTHENTICATION FULLY RESTORED & VERIFIED!] 🎉🎉🎉");
                console.log("Access Token acquired successfully! You can run sync now!");
            }
        } catch (e) {
            console.log("Key Auth Status:", e.message);
        }
    } else {
        console.log("Waiting for user to click 'Create' button and download the new JSON key...");
    }
})();
