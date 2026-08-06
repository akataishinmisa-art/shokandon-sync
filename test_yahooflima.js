const https = require('https');
const http = require('http');

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        const req = client.get(targetUrl, options, (res) => {
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
        req.setTimeout(8000, () => {
            req.destroy();
            reject(new Error('URL読み込みタイムアウト'));
        });
    });
}

function parseYahooFleamarketHtml(rawHtml) {
    let title = '';
    let price = '';
    let imageUrl = '';
    let shipping = '￥0';
    let description = '';

    // 1. Try __NEXT_DATA__ JSON parse
    const nextDataMatch = rawHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
        try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const pageProps = nextData?.props?.pageProps;
            const item = pageProps?.item || pageProps?.initialState?.item || pageProps?.itemDetail;
            if (item) {
                title = item.title || item.name || title;
                if (item.price) {
                    const p = parseInt(item.price, 10);
                    if (!isNaN(p)) price = `￥${p.toLocaleString('ja-JP')}`;
                }
                if (item.images && item.images.length > 0) {
                    imageUrl = item.images[0].url || item.images[0] || imageUrl;
                } else if (item.imageUrls && item.imageUrls.length > 0) {
                    imageUrl = item.imageUrls[0] || imageUrl;
                }
                if (item.description) description = item.description;
            }
        } catch(e) {
            console.log('__NEXT_DATA__ parse warning:', e.message);
        }
    }

    // 2. Fallback to LD+JSON
    if (!title || !price || !imageUrl) {
        const ldMatches = rawHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (ldMatches) {
            for (const ldStr of ldMatches) {
                try {
                    const cleanJson = ldStr.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                    const ld = JSON.parse(cleanJson);
                    if (ld['@type'] === 'Product' || ld.name) {
                        if (!title && ld.name) title = ld.name;
                        if (!imageUrl && ld.image) {
                            imageUrl = Array.isArray(ld.image) ? ld.image[0] : (ld.image.url || ld.image);
                        }
                        if (!price && ld.offers) {
                            const pVal = Array.isArray(ld.offers) ? ld.offers[0]?.price : ld.offers?.price;
                            if (pVal) {
                                const p = parseInt(pVal, 10);
                                if (!isNaN(p)) price = `￥${p.toLocaleString('ja-JP')}`;
                            }
                        }
                    }
                } catch(e) {}
            }
        }
    }

    // 3. Fallback to OGP Meta tags
    if (!title) {
        const ogTitleMatch = rawHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i) ||
                             rawHtml.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:title["']/i);
        if (ogTitleMatch) title = ogTitleMatch[1];
    }
    if (!imageUrl) {
        const ogImgMatch = rawHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                           rawHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (ogImgMatch) imageUrl = ogImgMatch[1];
    }
    if (!price) {
        const priceMatch = rawHtml.match(/<meta[^>]*property=["'](?:product:price:amount|og:price:amount)["'][^>]*content=["']([0-9]+)["']/i) ||
                           rawHtml.match(/<meta[^>]*name=["'](?:product:price:amount|itemprop=["']price["'])["'][^>]*content=["']([0-9]+)["']/i) ||
                           rawHtml.match(/"price"\s*:\s*"?([0-9]+)"?/i);
        if (priceMatch && priceMatch[1]) {
            const p = parseInt(priceMatch[1], 10);
            if (!isNaN(p)) price = `￥${p.toLocaleString('ja-JP')}`;
        }
    }

    // Clean up title
    let cleanTitle = title
        .replace(/\s*｜\s*Yahoo!フリマ.*$/i, '')
        .replace(/\s*-\s*PayPayフリマ.*$/i, '')
        .replace(/Yahoo!フリマ/gi, '')
        .replace(/PayPayフリマ/gi, '')
        .replace(/【/g, ' 【')
        .replace(/】/g, '】 ')
        .replace(/\s+/g, ' ')
        .trim();

    return { cleanTitle, price, imageUrl, shipping, description };
}

console.log('Parser functions defined successfully.');
