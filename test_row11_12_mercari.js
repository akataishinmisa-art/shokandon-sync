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
        { row: 12, url: 'https://jp.mercari.com/item/m47305420966' }
    ];

    for (const item of urls) {
        try {
            const html = await fetchUrlHtml(item.url);
            console.log(`=== Row ${item.row}: ${item.url} ===`);

            // Check title
            const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i);
            console.log(`Title Match:`, titleMatch ? titleMatch[1] : 'NONE');

            // Check price
            const priceMatch = html.match(/"price"\s*:\s*"?([0-9]+)"?/i) || html.match(/"priceAmount"\s*:\s*"?([0-9.]+)"?/i);
            console.log(`Price Match:`, priceMatch ? priceMatch[1] : 'NONE');

            // Check why it was marked as sold out!
            console.log(`Includes OutOfStock:`, html.includes('schema.org/OutOfStock'));
            console.log(`Includes ITEM_STATUS_SOLDOUT:`, html.includes('ITEM_STATUS_SOLDOUT'));
            console.log(`Includes 売り切れました:`, html.includes('売り切れました'));

            // Find all script tags or status occurrences
            const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
            if (jsonLdMatches) {
                console.log(`Found ${jsonLdMatches.length} JSON-LD blocks.`);
                jsonLdMatches.forEach((script, idx) => {
                    if (script.includes('OutOfStock')) {
                        console.log(`JSON-LD #${idx} contains OutOfStock:`, script.slice(0, 300));
                    }
                });
            }

            // Check Next.js __NEXT_DATA__
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
            if (nextDataMatch) {
                try {
                    const parsed = JSON.parse(nextDataMatch[1]);
                    const itemObj = parsed.props?.pageProps?.item || parsed.props?.pageProps?.initialState?.item?.item;
                    console.log(`NextData Item Status:`, itemObj ? itemObj.status : 'NOT FOUND');
                } catch (e) {
                    console.log(`NextData parse error:`, e.message);
                }
            }
        } catch (e) {
            console.log(`Row ${item.row} error:`, e.message);
        }
    }
})();
