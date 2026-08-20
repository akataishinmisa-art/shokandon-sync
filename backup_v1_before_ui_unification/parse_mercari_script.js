const https = require('https');

function parseMercariScript() {
    const encodedKw = encodeURIComponent('Nintendo Switch本体');
    const options = {
        hostname: 'jp.mercari.com',
        port: 443,
        path: `/search?keyword=${encodedKw}&status=on_sale`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'ja,en-US;q=0.9'
        }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const nextDataMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
            if (nextDataMatch) {
                try {
                    const parsed = JSON.parse(nextDataMatch[1]);
                    console.log('✅ NEXT_DATA JSON Parsed!');
                    console.log('Keys:', Object.keys(parsed));
                    if (parsed.props && parsed.props.pageProps) {
                        console.log('pageProps keys:', Object.keys(parsed.props.pageProps));
                    }
                } catch(e) {
                    console.log('JSON Parse error:', e.message);
                }
            } else {
                console.log('NEXT_DATA script not found.');
            }
        });
    });
}

parseMercariScript();
