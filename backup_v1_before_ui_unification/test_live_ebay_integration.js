const https = require('https');
const http = require('http');

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
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
            reject(new Error('Timeout'));
        });
    });
}

async function fetchLiveEbaySoldPrices(searchQuery) {
    if (!searchQuery || !searchQuery.trim()) return null;

    let cleanKw = searchQuery
        .replace(/【[^】]+】|\[[^\]]+\]/g, ' ')
        .replace(/【|】|中古|美品|極美品|ジャンク|動作確認済|箱付|セット|本体のみ/gi, '')
        .trim();

    const enMatches = cleanKw.match(/[A-Za-z0-9\-_.]+/g);
    if (enMatches && enMatches.length > 0) {
        cleanKw = enMatches.join(' ');
    }

    if (!cleanKw || cleanKw.length < 2) return null;

    try {
        const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanKw)}&LH_Sold=1&LH_Complete=1&_ipg=25`;
        const html = await fetchUrlHtml(targetUrl);
        
        const prices = [];
        const regex = /class="s-item__price"[^>]*>(?:<span[^>]*>)?\s*\$([0-9,.]+)/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            const p = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(p) && p > 5 && p < 10000) {
                prices.push(p);
            }
        }

        if (prices.length > 0) {
            prices.sort((a, b) => a - b);
            const sPrice = Math.round(prices[Math.floor(prices.length * 0.85)] || prices[prices.length - 1]);
            const aPrice = Math.round(prices[Math.floor(prices.length * 0.50)] || prices[Math.floor(prices.length / 2)]);
            const bPrice = Math.round(prices[Math.floor(prices.length * 0.20)] || prices[0]);

            return {
                s: `$${sPrice}`,
                a: `$${aPrice}`,
                b: `$${bPrice}`,
                count: prices.length,
                query: cleanKw
            };
        }
    } catch (e) {
        console.warn('[Live eBay Search Warning]:', e.message);
    }
    return null;
}

(async () => {
    console.log('Live eBay P900:', await fetchLiveEbaySoldPrices('Nikon COOLPIX P900'));
    console.log('Live eBay PCH-2000:', await fetchLiveEbaySoldPrices('Sony PS Vita PCH-2000'));
    console.log('Live eBay EX-ZR100:', await fetchLiveEbaySoldPrices('Casio Exilim EX-ZR100'));
})();
