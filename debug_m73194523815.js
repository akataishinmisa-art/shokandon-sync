const https = require('https');

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const req = https.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

(async () => {
    const html = await fetchUrlHtml('https://jp.mercari.com/item/m73194523815');
    console.log('HTML length:', html.length);

    // Search for numbers with price or 3100
    const m = html.match(/"price"\s*:\s*([0-9]+)/) ||
              html.match(/price["']?\s*:\s*["']?([0-9]+)/) ||
              html.match(/3100/);
    console.log('Price match in m73194523815:', m);
})();
