const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        console.log("Testing Time Offset Fixed Google Auth...");
        const keyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'google_service_account.json'), 'utf8'));
        
        const jwtClient = new google.auth.JWT({
            email: keyData.client_email,
            key: keyData.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        // 過去数分〜未来のタイムラグを吸収するため iat タイムスタンプを直接上書き
        jwtClient.createJWT = function() {
            const now = Math.floor(Date.now() / 1000);
            this.iat = now - 60; // 60秒過去の時刻として署名を作成
            return google.auth.JWT.prototype.createJWT.call(this);
        };

        const token = await jwtClient.authorize();
        console.log("SUCCESS WITH IAT OFFSET! Token:", token.access_token ? "OK" : "NONE");
    } catch (e) {
        console.error("ERROR FETCHING TOKEN:", e.message);
    }
})();
