const http = require('http');

function saveSettings(data) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/user-settings',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.write(postData);
        req.end();
    });
}

function getSettings() {
    return new Promise((resolve) => {
        http.get('http://localhost:3000/api/user-settings', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
    });
}

(async () => {
    console.log('--- Testing Server-side Settings Persistence ---');
    const saved = await saveSettings({ exchange: '155.5', margin: '25%', exportShipping: '￥2,800' });
    console.log('Save Result:', saved);

    const loaded = await getSettings();
    console.log('Load Result:', loaded);
})();
