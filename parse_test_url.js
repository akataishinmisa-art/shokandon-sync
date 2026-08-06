const http = require('http');

const url = 'https://store.shopping.yahoo.co.jp/excellar/1350013328.html';

(async () => {
    try {
        console.log('1. Parsing URL metadata for:', url);
        const metaResp = await fetch('http://localhost:3000/api/parse-url-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const meta = await metaResp.json();
        console.log('Parsed Metadata:', meta);

        const mpn = meta.mpn || meta.title || 'P500';
        console.log('\n2. Looking up eBay sold prices for MPN/Model:', mpn);
        const dbResp = await fetch('http://localhost:3000/api/lookup-product-db?mpn=' + encodeURIComponent(mpn));
        const dbPrices = await dbResp.json();
        console.log('eBay Sold Prices from DB:', dbPrices);

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
