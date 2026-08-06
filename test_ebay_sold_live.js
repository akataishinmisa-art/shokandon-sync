const https = require('https');

function searchEbaySoldPrices(keyword) {
    return new Promise(resolve => {
        if (!keyword || !keyword.trim()) return resolve({ s: '-', a: '-', b: '-', count: 0 });

        // Clean keyword to search model number / English words
        const cleanKw = keyword
            .replace(/[【】\[\]（）]/g, ' ')
            .replace(/美品|ジャンク|箱付|動作確認済|セット|まとめ/g, '')
            .trim();

        const url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(cleanKw) + '&LH_Sold=1&LH_Complete=1&_ipg=30';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        };

        https.get(url, options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const prices = [];
                const regex = /class="s-item__price"[^>]*>(?:<span[^>]*>)?\s*\$([0-9,.]+)/gi;
                let match;
                while ((match = regex.exec(data)) !== null) {
                    const val = parseFloat(match[1].replace(/,/g, ''));
                    if (!isNaN(val) && val > 5 && val < 5000) {
                        prices.push(val);
                    }
                }

                if (prices.length === 0) {
                    return resolve({ s: '-', a: '-', b: '-', count: 0 });
                }

                // Sort prices low to high
                prices.sort((a, b) => a - b);

                // High tier (85th percentile) -> S rank
                // Mid tier (50th percentile / median) -> A rank
                // Low tier (20th percentile) -> B rank
                const sIdx = Math.floor(prices.length * 0.85);
                const aIdx = Math.floor(prices.length * 0.50);
                const bIdx = Math.floor(prices.length * 0.20);

                const sPrice = '$' + Math.round(prices[sIdx] || prices[prices.length - 1]);
                const aPrice = '$' + Math.round(prices[aIdx] || prices[0]);
                const bPrice = '$' + Math.round(prices[bIdx] || prices[0]);

                resolve({ s: sPrice, a: aPrice, b: bPrice, count: prices.length });
            });
        }).on('error', err => {
            console.error('eBay fetch error:', err.message);
            resolve({ s: '-', a: '-', b: '-', count: 0 });
        });
    });
}

(async () => {
    console.log('Searching PCH-2000:', await searchEbaySoldPrices('PCH-2000'));
    console.log('Searching EX-Z550:', await searchEbaySoldPrices('EX-Z550'));
    console.log('Searching DMC-FX90:', await searchEbaySoldPrices('DMC-FX90'));
})();
