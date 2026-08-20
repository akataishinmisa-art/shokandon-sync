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
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const parsed = new URL(targetUrl);
                    redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
                }
                return fetchUrlHtml(redirectUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

(async () => {
    const urls = [
        { row: 11, url: 'https://jp.mercari.com/item/m93639973805' },
        { row: 12, url: 'https://jp.mercari.com/item/m47305420966' },
        { row: 32, url: 'https://jp.mercari.com/item/m68792414248' } // Sold out
    ];

    for (const item of urls) {
        const html = await fetchUrlHtml(item.url);
        console.log(`\n=== Row ${item.row}: ${item.url} ===`);

        // Check JSON-LD specifically for "@type": "Product" or "@type": "ItemPage"
        let jsonLdIsSoldOut = false;
        let jsonLdPrice = '';
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
            for (const scriptTag of jsonLdMatches) {
                const jsonText = scriptTag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                try {
                    const parsed = JSON.parse(jsonText);
                    const type = parsed['@type'];
                    if (type === 'Product' || type === 'ItemPage') {
                        const offers = parsed.offers || (parsed.mainEntity && parsed.mainEntity.offers);
                        if (offers) {
                            if (offers.price) jsonLdPrice = offers.price;
                            if (offers.availability && offers.availability.includes('OutOfStock')) {
                                jsonLdIsSoldOut = true;
                            }
                        }
                    }
                } catch (e) {}
            }
        }

        // Check __NEXT_DATA__ item status
        let nextDataStatus = '';
        let nextDataPrice = '';
        const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        if (nextMatch) {
            try {
                const nextData = JSON.parse(nextMatch[1]);
                const pageProps = nextData.props?.pageProps;
                const itemData = pageProps?.item || pageProps?.initialState?.item?.item;
                if (itemData) {
                    nextDataStatus = itemData.status; // ITEM_STATUS_ON_SALE vs ITEM_STATUS_SOLDOUT vs ITEM_STATUS_TRADING
                    nextDataPrice = itemData.price;
                }
            } catch (e) {}
        }

        console.log(`JSON-LD Price: "${jsonLdPrice}" | JSON-LD OutOfStock: ${jsonLdIsSoldOut}`);
        console.log(`NextData Price: "${nextDataPrice}" | NextData Status: "${nextDataStatus}"`);
    }
})();
