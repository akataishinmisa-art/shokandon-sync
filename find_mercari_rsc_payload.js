const https = require('https');

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        const req = https.get(targetUrl, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

(async () => {
    // Row 11 (Active)
    const html11 = await fetchUrlHtml('https://jp.mercari.com/item/m93639973805');
    console.log('=== Row 11 matches ===');
    const matches11 = html11.match(/ITEM_STATUS[A_Z_]*/g) || [];
    console.log('ITEM_STATUS matches:', matches11);

    const priceMatches11 = html11.match(/"price"\s*:\s*"?([0-9]+)"?/gi) || [];
    console.log('Price matches:', priceMatches11);

    // Row 32 (Sold Out)
    const html32 = await fetchUrlHtml('https://jp.mercari.com/item/m68792414248');
    console.log('\n=== Row 32 matches (Sold Out) ===');
    const matches32 = html32.match(/ITEM_STATUS[A_Z_]*/g) || [];
    console.log('ITEM_STATUS matches:', matches32);

    const priceMatches32 = html32.match(/"price"\s*:\s*"?([0-9]+)"?/gi) || [];
    console.log('Price matches:', priceMatches32);
})();
