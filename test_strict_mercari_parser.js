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
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
    });
}

function getMercariItemDataDirect(targetUrl) {
    return fetchUrlHtml(targetUrl).then(html => {
        let title = '';
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/\s*-\s*メルカリ.*/i, '').replace(/by メルカリ.*/i, '').trim();
        }

        let price = '';
        const priceMetaMatch = html.match(/<meta\s+name="product:price:amount"\s+content="([0-9]+)"/i) ||
                               html.match(/"price"\s*:\s*"?([0-9]+)"?/i);
        if (priceMetaMatch && priceMetaMatch[1]) {
            const p = parseInt(priceMetaMatch[1], 10);
            if (!isNaN(p) && p > 0) price = p.toLocaleString('ja-JP') + '円';
        }

        let isClosed = false;
        // Strictly inspect target item Schema.org JSON-LD (do NOT match loose outerHTML!)
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
            for (const scriptTag of jsonLdMatches) {
                const jsonText = scriptTag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                if (jsonText.includes('"Product"') || jsonText.includes('"ItemPage"')) {
                    try {
                        const parsed = JSON.parse(jsonText);
                        const offers = parsed.offers || (parsed.mainEntity && parsed.mainEntity.offers);
                        if (offers) {
                            const avail = Array.isArray(offers) ? offers[0].availability : offers.availability;
                            if (avail && typeof avail === 'string' && avail.includes('OutOfStock')) {
                                isClosed = true;
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        // If target item Schema.org JSON-LD specifically indicates OutOfStock, or target page has sold out banner
        if (html.includes('"status":"ITEM_STATUS_SOLDOUT"') || html.includes('itemStatus":"ITEM_STATUS_SOLDOUT"')) {
            isClosed = true;
        }

        return {
            title: title || '',
            price,
            statusText: isClosed ? '欠品' : '販売中',
            isClosed
        };
    }).catch(e => null);
}

(async () => {
    const urls = [
        { row: 11, url: 'https://jp.mercari.com/item/m93639973805' }, // Row 11 (Active)
        { row: 12, url: 'https://jp.mercari.com/item/m47305420966' }, // Row 12 (Active)
        { row: 30, url: 'https://jp.mercari.com/item/m84232271607' }, // Row 30 (Sold Out)
        { row: 31, url: 'https://jp.mercari.com/item/m64420642136' }, // Row 31 (Sold Out)
        { row: 32, url: 'https://jp.mercari.com/item/m68792414248' }  // Row 32 (Sold Out)
    ];

    for (const item of urls) {
        const res = await getMercariItemDataDirect(item.url);
        console.log(`Row ${item.row}:`, JSON.stringify(res));
    }
})();
