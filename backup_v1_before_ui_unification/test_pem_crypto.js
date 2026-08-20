const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

try {
    const keyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'google_service_account.json'), 'utf8'));
    console.log("Checking Private Key Pem format...");
    
    const sign = crypto.createSign('SHA256');
    sign.update('test data');
    const signature = sign.sign(keyData.private_key, 'base64');
    console.log("PEM Private Key Signature check passed! Signature length:", signature.length);
} catch (e) {
    console.error("PEM Private Key is INVALID or CORRUPTED:", e.message);
}
