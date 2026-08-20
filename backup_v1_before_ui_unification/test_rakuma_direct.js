const https = require('https');
const http = require('http');

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchHtml(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function getRakumaItemDataDirect(url) {
    try {
        const html = await fetchHtml(url);
        let title = '';
        let price = '';
        let isClosed = false;

        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                           html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1]
                .replace(/\s*-\s*ラクマ.*/i, '')
                .replace(/\s*\|\s*ラクマ.*/i, '')
                .replace(/通販\s*by\s*.*/i, '')
                .trim();
        }

        const priceMatch = html.match(/<meta\s+property="product:price:amount"\s+content="([0-9]+)"/i) ||
                           html.match(/"price":\s*([0-9]+)/) ||
                           html.match(/class="item__price[^"]*">\s*￥?\s*([0-9,]+)/i);
        if (priceMatch && priceMatch[1]) {
            price = parseInt(priceMatch[1].replace(/,/g, ''), 10).toLocaleString('ja-JP') + '円';
        }

        if (html.includes('該当の商品は削除されました') || html.includes('商品が見つかりませんでした') || html.includes('指定されたページは見つかりませんでした')) {
            isClosed = true;
            title = '欠品（削除された商品）';
        } else if (html.includes('item__badge--soldout') || html.includes('SOLD OUT') || html.includes('売り切れました')) {
            isClosed = true;
        }

        const statusText = isClosed ? '欠品' : '販売中';
        return { title, price, isClosed, statusText };
    } catch (e) {
        return null;
    }
}

async function test() {
    const url = 'https://item.fril.jp/22d4c7937f576d2d652ad56a192d6d2e';
    console.log('Testing direct Rakuma parser on:', url);
    const data = await getRakumaItemDataDirect(url);
    console.log('Direct Parse Result:', data);
}

test();
