const http = require('http');

function testParseEndpoint(url) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ url });
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/parse-url-meta',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve({ raw: data });
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function run() {
    console.log('Testing Yahoo Fleamarket URL Parsing via Server Endpoint...');
    // Example test URL (PayPay / Yahoo Fleamarket)
    const testUrl = 'https://paypayfleamarket.yahoo.co.jp/item/z123456789';
    try {
        const res = await testParseEndpoint(testUrl);
        console.log('API Response:', res);
    } catch(e) {
        console.error('Test Failed:', e.message);
    }
}

run();
