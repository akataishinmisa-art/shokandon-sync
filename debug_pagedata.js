const https = require('https');
https.get('https://auctions.yahoo.co.jp/jp/auction/u1238271947', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
        const idx = html.indexOf('var pageData =');
        if (idx !== -1) {
            console.log(html.substring(idx, idx + 500));
        } else {
            console.log('pageData Not found');
        }
    });
});
