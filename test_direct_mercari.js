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
    const url = 'https://jp.mercari.com/item/m68792414248';
    const html = await fetchHtml(url);

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (nextDataMatch) {
        try {
            const nextJson = JSON.parse(nextDataMatch[1]);
            const itemObj = (nextJson.props && nextJson.props.pageProps && (nextJson.props.pageProps.item || (nextJson.props.pageProps.initialState && nextJson.props.pageProps.initialState.item))) || null;
            console.log('Item Status in __NEXT_DATA__:', itemObj ? itemObj.status : 'null');
            console.log('Item Name in __NEXT_DATA__:', itemObj ? itemObj.name : 'null');
            console.log('HTML includes ITEM_STATUS_SOLDOUT:', html.includes('ITEM_STATUS_SOLDOUT'));
            console.log('HTML includes isSoldOut:', html.includes('isSoldOut'));
            console.log('HTML includes ITEM_STATUS_TRADING:', html.includes('ITEM_STATUS_TRADING'));
            console.log('HTML includes 売り切れ:', html.includes('売り切れ'));
        } catch (e) {
            console.error(e);
        }
    } else {
        console.log('No NEXT_DATA match found');
    }
})();
