const http = require('http');

function testMeta(port, url) {
    return new Promise((resolve) => {
        const postData = JSON.stringify({ url });
        const req = http.request({
            hostname: 'localhost',
            port: port,
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
                    const json = JSON.parse(data);
                    console.log(`[Backtest Port ${port}]: Success=${json.success}, Price="${json.price}", Shipping="${json.shipping}", Title="${json.title.substring(0,30)}..."`);
                } catch(e) {
                    console.error(`[Backtest Port ${port} Raw]:`, data);
                }
                resolve(true);
            });
        });
        req.on('error', (err) => {
            console.error(`[Backtest Port ${port} Error]:`, err.message);
            resolve(false);
        });
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('--- Backtesting Price & Shipping extraction ---');
    await testMeta(3000, 'https://www.amazon.co.jp/dp/B001RLZ94S/');
    await testMeta(8085, 'https://www.amazon.co.jp/dp/B001RLZ94S/');
})();
