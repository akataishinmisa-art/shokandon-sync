const http = require('http');

const testUrl = 'https://paypayfleamarket.yahoo.co.jp/item/z328124234'; // active Yahoo fleamarket product

const data = JSON.stringify({ url: testUrl });

const req = http.request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/parse-meta',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('API Response:', JSON.parse(body));
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.write(data);
req.end();
