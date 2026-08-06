const http = require('http');

function checkExact(url) {
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
            console.log('API RESPONSE:', data);
        });
    });
    req.write(postData);
    req.end();
}

checkExact('https://jp.mercari.com/item/m73194523815');
