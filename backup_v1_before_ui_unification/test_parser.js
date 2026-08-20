const https = require('https');

function getAuctionData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                const titleMatch = html.match(/<title>(.*?)<\/title>/i);
                let title = titleMatch ? titleMatch[1].replace(' - Yahoo!オークション', '').replace(' - ヤフオク!', '').trim() : '';

                // Match price from price tag or pageData
                let price = '';
                const bidsMatch = html.match(/"price":"(\d+)"/);
                if (bidsMatch) {
                    price = parseInt(bidsMatch[1], 10).toLocaleString('ja-JP') + '円';
                }

                resolve({ title, price });
            });
        }).on('error', reject);
    });
}

getAuctionData('https://auctions.yahoo.co.jp/jp/auction/u1238271947').then(console.log);
