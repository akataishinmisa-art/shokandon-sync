const https = require('https');
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log('Testing LINE Push with config:');
console.log('User ID:', cfg.lineUserId);
console.log('Token Length:', cfg.lineChannelAccessToken ? cfg.lineChannelAccessToken.length : 0);

const payload = JSON.stringify({
    to: cfg.lineUserId,
    messages: [{ type: 'text', text: '📱【商管どん】LINEテスト通知です！' }]
});

const req = https.request('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.lineChannelAccessToken}`,
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('StatusCode:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        console.log('Body:', body);
    });
});

req.on('error', (err) => console.error('Error:', err.message));
req.write(payload);
req.end();
