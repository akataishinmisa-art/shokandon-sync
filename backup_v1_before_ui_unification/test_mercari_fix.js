const https = require('https');

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

(async () => {
    const activeUrl = 'https://jp.mercari.com/item/m29164806695'; // Row 17 (Kyoto Kitty)
    const deletedUrl = 'https://jp.mercari.com/item/m64420642136'; // Row 34 (Deleted item)

    console.log('Testing Active Item:', activeUrl);
    const activeHtml = await fetchHtml(activeUrl);
    console.log('Active includes "該当する商品は削除されています":', activeHtml.includes('該当する商品は削除されています'));
    console.log('Active includes "削除された商品":', activeHtml.includes('削除された商品'));

    const nextMatch = activeHtml.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (nextMatch) {
        try {
            const json = JSON.parse(nextMatch[1]);
            const item = json.props.pageProps.item || json.props.pageProps.initialState.item;
            console.log('Active Item Name:', item ? item.name : 'null');
            console.log('Active Item Price:', item ? item.price : 'null');
            console.log('Active Item Status:', item ? item.status : 'null');
        } catch (e) {
            console.error(e.message);
        }
    }

    console.log('\nTesting Deleted Item:', deletedUrl);
    const deletedHtml = await fetchHtml(deletedUrl);
    console.log('Deleted includes "該当する商品は削除されています":', deletedHtml.includes('該当する商品は削除されています'));
    console.log('Deleted includes "削除された商品":', deletedHtml.includes('削除された商品'));
})();
