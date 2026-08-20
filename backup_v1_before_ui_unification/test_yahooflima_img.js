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

function extractYahooFleamarketItemImages(html) {
    const images = [];

    // 1. __NEXT_DATA__ JSON Parser (100% Strict & Isolated for Item Images)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
        try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const pageProps = nextData?.props?.pageProps;
            const item = pageProps?.item || pageProps?.initialState?.item || pageProps?.itemDetail || pageProps?.productDetail;
            if (item) {
                const itemImgs = item.images || item.imageUrls || item.itemImages || [];
                for (const imgObj of itemImgs) {
                    let u = typeof imgObj === 'string' ? imgObj : (imgObj?.url || imgObj?.src || imgObj?.originalUrl);
                    if (u && typeof u === 'string' && u.startsWith('http')) {
                        images.push(u);
                    }
                }
            }
        } catch (e) {
            console.warn('[__NEXT_DATA__ Exception]:', e.message);
        }
    }

    return images;
}

console.log('Test script ready.');
