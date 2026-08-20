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
    // Row 11 (Active - 2500 yen)
    const html11 = await fetchUrlHtml('https://jp.mercari.com/item/m93639973805');
    console.log('=== Row 11 matches for 2500 ===');
    const idx11 = html11.indexOf('2500');
    if (idx11 !== -1) {
        console.log('Found 2500 in HTML:', html11.slice(Math.max(0, idx11 - 100), idx11 + 200));
    } else {
        console.log('2500 NOT found in raw HTML!');
    }

    // Row 12 (Active - 1000 yen)
    const html12 = await fetchUrlHtml('https://jp.mercari.com/item/m47305420966');
    console.log('\n=== Row 12 matches for 1000 ===');
    const idx12 = html12.indexOf('1000');
    if (idx12 !== -1) {
        console.log('Found 1000 in HTML:', html12.slice(Math.max(0, idx12 - 100), idx12 + 200));
    } else {
        console.log('1000 NOT found in raw HTML!');
    }
})();
