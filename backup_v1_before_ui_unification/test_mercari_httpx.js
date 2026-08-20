const https = require('https');

function testMercariHttpx(keyword) {
    const encodedKw = encodeURIComponent(keyword);
    const url = `https://jp.mercari.com/search?keyword=${encodedKw}&status=on_sale`;
    
    const options = {
        hostname: 'jp.mercari.com',
        port: 443,
        path: `/search?keyword=${encodedKw}&status=on_sale`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Mercari HTML Status:', res.statusCode);
            console.log('Data length:', data.length);
            const itemMatches = data.match(/href="(\/item\/m[0-9]+)"/g);
            if (itemMatches) {
                console.log(`✅ メルカリHTMLから ${itemMatches.length} 件のアイテムURLを検知！`);
                console.log('先頭5件:', itemMatches.slice(0, 5));
            } else {
                console.log('Item matches null. Sample data:', data.slice(0, 500));
            }
        });
    }).on('error', e => console.error(e));
}

testMercariHttpx('Nintendo Switch本体');
