const https = require('https');

function getAuctionData(url) {
    return new Promise((resolve, reject) => {
        const aucId = url.split('/').pop().split('?')[0];
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                // Find pageData JSON or item JSON with matching productID
                let title = '';
                let price = '';

                const itemMatch = html.match(new RegExp(`"productID":"${aucId}".*?"productName":"(.*?)".*?"price":"(\\d+)"`));
                if (itemMatch) {
                    title = itemMatch[1];
                    price = parseInt(itemMatch[2], 10).toLocaleString('ja-JP') + '円';
                } else {
                    const pageDataMatch = html.match(/var pageData = (.*?);/);
                    if (pageDataMatch) {
                        try {
                            const data = JSON.parse(pageDataMatch[1]);
                            if (data.items && data.items.productID === aucId) {
                                title = data.items.productName;
                                price = parseInt(data.items.price, 10).toLocaleString('ja-JP') + '円';
                            }
                        } catch (e) {}
                    }
                }

                resolve({ aucId, title, price });
            });
        }).on('error', reject);
    });
}

getAuctionData('https://auctions.yahoo.co.jp/jp/auction/u1238271947').then(console.log);
