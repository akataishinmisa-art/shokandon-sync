const fs = require('fs');

const https = require('https');

function parseMercariHtml() {
    const encodedKw = encodeURIComponent('Nintendo Switch本体');
    const options = {
        hostname: 'jp.mercari.com',
        port: 443,
        path: `/search?keyword=${encodedKw}&status=on_sale`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'ja,en-US;q=0.9'
        }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            // Find items JSON or item links in HTML
            console.log('Searching for item links/JSON in Mercari HTML...');
            const matches = data.match(/\/item\/(m[0-9]+)/g);
            if (matches) {
                const uniqueItems = Array.from(new Set(matches));
                console.log(`✅ メルカリHTMLから ${uniqueItems.length} 件の商品IDを発見！`);
                console.log('Sample IDs:', uniqueItems.slice(0, 5));
            } else {
                console.log('No item matches. Checking JSON data script...');
                const jsonMatch = data.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
                if (jsonMatch) {
                    console.log('Found __NEXT_DATA__ length:', jsonMatch[1].length);
                }
            }
        });
    });
}

parseMercariHtml();
