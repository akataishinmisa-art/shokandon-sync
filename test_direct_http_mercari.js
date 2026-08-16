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
        'https://jp.mercari.com/item/m41184150225', // Row 4
        'https://jp.mercari.com/item/m72933327124', // Row 9
        'https://jp.mercari.com/item/m16911070939', // Row 10
        'https://jp.mercari.com/item/m68792414248'  // Row 32 (Sold Out)
    ];

    for (const url of urls) {
        const start = Date.now();
        try {
            const html = await fetchUrlHtml(url);
            const duration = Date.now() - start;

            let title = '';
            const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
            if (titleMatch) title = titleMatch[1];

            let isSoldOut = false;
            if (html.includes('schema.org/OutOfStock') || html.includes('"availability":"https://schema.org/OutOfStock"') || html.includes('売り切れました') || html.includes('"status":"ITEM_STATUS_SOLDOUT"')) {
                isSoldOut = true;
            }

            console.log(`URL: ${url}`);
            console.log(`Time: ${duration}ms | Title: "${title}" | SoldOut: ${isSoldOut}`);
        } catch (e) {
            console.log(`URL: ${url} | Error: ${e.message}`);
        }
    }
})();
