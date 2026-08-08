const https = require('https');

function fetchJson(url) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'MercariPay/3.20.0 (Android 12; Pixel 6)',
                'Accept': 'application/json',
                'X-Platform': 'android'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, json: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, raw: data.substring(0, 300) });
                }
            });
        });
        req.on('error', (err) => resolve({ error: err.message }));
    });
}

(async () => {
    const itemId = 'm39524434148';
    console.log('Testing Mercari API v2...');
    const r1 = await fetchJson(`https://api.mercari.jp/items/get?id=${itemId}`);
    console.log('API v1 Result:', r1.status, r1.json ? r1.json.data : r1.raw);

    const r2 = await fetchJson(`https://api.mercari.jp/v2/entities/items/${itemId}`);
    console.log('API v2 Result:', r2.status, r2.json ? r2.json.data : r2.raw);
})();
