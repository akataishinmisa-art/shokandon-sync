const https = require('https');
const fs = require('fs');

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
    fs.writeFileSync('m73194523815.html', html, 'utf8');

    // Find all occurrences of "price" case insensitive
    const matches = [];
    const reg = /price["\\]*:["\\]*([0-9]+)/gi;
    let m;
    while ((m = reg.exec(html)) !== null) {
        matches.push(m[0]);
    }
    console.log('Price matches:', matches);

    // Find all 4-digit numbers in the html
    const nums = html.match(/"[a-zA-Z]+":\s*([0-9]{3,6})/g) || [];
    console.log('Key-num matches:', nums.slice(0, 15));
})();
