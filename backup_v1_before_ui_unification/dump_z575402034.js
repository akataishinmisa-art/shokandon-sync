const https = require('https');

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        https.get(targetUrl, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function inspect() {
    const url = 'https://paypayfleamarket.yahoo.co.jp/item/z575402034';
    const html = await fetchUrlHtml(url);
    console.log('HTML Length:', html.length);
    
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
        const json = JSON.parse(nextDataMatch[1]);
        const item = json?.props?.pageProps?.item || json?.props?.pageProps?.itemDetail;
        console.log('Item Title:', item?.title);
        console.log('Item Images Array:', item?.images);
    } else {
        console.log('__NEXT_DATA__ not found');
        const imgMatches = html.match(/https:\/\/[^"'\s]*\.yimg\.jp\/[^\s"'<>]+/gi) || [];
        console.log('Yimg Matches:', Array.from(new Set(imgMatches)).slice(0, 10));
    }
}

inspect();
