const https = require('https');
https.get('https://auctions.yahoo.co.jp/jp/auction/u1238271947', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
        const idx = html.indexOf('u1238271947');
        if (idx !== -1) {
            console.log(html.substring(idx - 100, idx + 400));
        } else {
            console.log('Not found');
        }
    });
});
