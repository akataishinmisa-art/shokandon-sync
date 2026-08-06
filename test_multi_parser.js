const https = require('https');
const http = require('http');

function fetchHtml(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

async function getItemData(url) {
    if (url.includes('auctions.yahoo.co.jp')) {
        const aucId = url.split('/').pop().split('?')[0];
        const html = await fetchHtml(url);
        let title = '';
        let price = '';
        let isClosed = false;

        const pageDataMatch = html.match(/var pageData = (.*?);/);
        if (pageDataMatch) {
            try {
                const data = JSON.parse(pageDataMatch[1]);
                if (data.items) {
                    title = data.items.productName || '';
                    price = parseInt(data.items.price, 10).toLocaleString('ja-JP') + '円';
                    isClosed = (data.items.isClosed === '1' || data.items.hasWinner === '1');
                }
            } catch (e) {}
        }

        if (!title) {
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            title = titleMatch ? titleMatch[1].replace(' - Yahoo!オークション', '').replace(' - ヤフオク!', '').trim() : '';
        }

        if (html.includes('このオークションは終了しています') || html.includes('オークション終了')) {
            isClosed = true;
        }

        const statusText = isClosed ? '欠品' : '販売中';
        return { type: 'yahoo', aucId, title, price, isClosed, statusText };
    } else if (url.includes('amazon.co.jp')) {
        const html = await fetchHtml(url);
        let title = '';
        let price = '';
        let isClosed = false;

        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1].replace('Amazon.co.jp:', '').replace('Amazon |', '').trim();
        }

        const priceMatch = html.match(/class="a-offscreen">([^<]+)<\/span>/i) || html.match(/￥([\d,]+)/);
        if (priceMatch) {
            price = priceMatch[1].trim();
            if (!price.includes('円') && !price.includes('￥')) {
                price = '￥' + price;
            }
        }

        if (html.includes('一時的に在庫切れ') || html.includes('現在お取り扱いしておりません') || html.includes('在庫切れ')) {
            isClosed = true;
        }

        const statusText = isClosed ? '欠品' : '販売中';
        return { type: 'amazon', title, price, isClosed, statusText };
    }

    return { type: 'unknown', title: '不明', price: '', isClosed: false, statusText: '販売中' };
}

(async () => {
    const urls = [
        'https://auctions.yahoo.co.jp/jp/auction/o1238378734',
        'https://www.amazon.co.jp/%E3%82%B3%E3%83%B3%E3%83%90%E3%83%BC%E3%82%B9-%E3%82%B9%E3%83%8B%E3%83%BC%E3%82%AB%E3%83%BC-NEXTAR-110-HI/dp/B07SW2ZCRF/',
        'https://auctions.yahoo.co.jp/jp/auction/w1238253716'
    ];

    for (const u of urls) {
        console.log('Testing URL:', u);
        const res = await getItemData(u);
        console.log('Result:', res);
    }
})();
