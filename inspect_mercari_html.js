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
    console.log('--- Row 11 HTML sample ---');
    const scripts11 = html11.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    scripts11.forEach(s => {
        if (s.includes('price') || s.includes('status') || s.includes('m93639973805')) {
            console.log('Script Match:', s.slice(0, 400));
        }
    });

    // Row 32 (Sold Out)
    const html32 = await fetchUrlHtml('https://jp.mercari.com/item/m68792414248');
    console.log('\n--- Row 32 HTML sample (Sold Out) ---');
    const scripts32 = html32.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    scripts32.forEach(s => {
        if (s.includes('price') || s.includes('status') || s.includes('m68792414248')) {
            console.log('Script Match:', s.slice(0, 400));
        }
    });
})();
