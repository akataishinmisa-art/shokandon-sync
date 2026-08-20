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

function getYahooShoppingItemDataDirect(targetUrl) {
    return fetchUrlHtml(targetUrl).then(html => {
        let title = '';
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i) ||
                           html.match(/<meta[^>]*name=["']title["'][^>]*content=["']([\s\S]*?)["']/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/ - Yahoo!ショッピング.*/i, '').replace(/ : .*/i, '').trim();
        }

        let price = '';
        const priceMatch = html.match(/"price"\s*:\s*"?([0-9]+)"?/i) ||
                           html.match(/class="[^"]*Price[^"]*"[^>]*>\s*([0-9,]+)\s*円/i) ||
                           html.match(/"priceAmount"\s*:\s*"?([0-9]+)"?/i);
        if (priceMatch && priceMatch[1]) {
            const p = parseInt(priceMatch[1].replace(/,/g, ''), 10);
            if (!isNaN(p) && p > 0) price = p.toLocaleString('ja-JP') + '円';
        }

        let isClosed = false;
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
            for (const scriptTag of jsonLdMatches) {
                const jsonText = scriptTag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                if (jsonText.includes('Product') || jsonText.includes('ItemPage') || jsonText.includes('schema.org')) {
                    try {
                        const parsed = JSON.parse(jsonText);
                        const offers = parsed.offers || (parsed['@graph'] && parsed['@graph'].find(o => o.offers)?.offers);
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

        if (html.includes('id="elItemStatus"') && (html.includes('在庫切れ') || html.includes('販売終了'))) {
            isClosed = true;
        }

        return {
            title: title || '',
            price,
            statusText: isClosed ? '欠品' : '販売中',
            isClosed
        };
    });
}

(async () => {
    const res = await getYahooShoppingItemDataDirect('https://store.shopping.yahoo.co.jp/senrakuen/e580.html');
    console.log('Result:', JSON.stringify(res, null, 2));
})();
