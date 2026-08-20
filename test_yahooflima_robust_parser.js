const fs = require('fs');

const testRows = [32, 50, 52];

for (const rowNum of testRows) {
    const filename = `row_${rowNum}_yahooflima.html`;
    if (!fs.existsSync(filename)) continue;
    const html = fs.readFileSync(filename, 'utf8');

    let title = '';
    let price = '';
    let isClosed = false;

    // 1. JSON-LD Schema
    const ldJsonMatches = html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
    for (const match of ldJsonMatches) {
        try {
            const data = JSON.parse(match[1]);
            if (data['@type'] === 'Product' || data.name || data.offers) {
                if (data.name) title = data.name;
                if (data.offers && data.offers.price) {
                    price = parseInt(data.offers.price, 10).toLocaleString('ja-JP') + '円';
                }
            }
        } catch (e) {}
    }

    // 2. Embedded JSON / Next / __PRELOADED_STATE__
    if (!price) {
        const priceMatch = html.match(/"price"\s*:\s*"?(\d+)"?/);
        if (priceMatch) {
            price = parseInt(priceMatch[1], 10).toLocaleString('ja-JP') + '円';
        }
    }

    // 3. Fallback Regex for ItemPrice
    if (!price) {
        const domPriceMatch = html.match(/ItemPrice[^>]*>.*?([0-9,]+)\s*<\/span>\s*<span[^>]*>円/s);
        if (domPriceMatch) {
            price = domPriceMatch[1].replace(/[^0-9]/g, '') + '円';
        }
    }

    // 4. Status Check
    if (html.includes('この商品は存在しません') || html.includes('公開が停止')) {
        isClosed = true;
    } else if (html.includes('この情報をコピーして出品する') || html.includes('ItemPrice_soldOut')) {
        isClosed = true;
    } else if (html.includes('購入手続きへ')) {
        isClosed = false;
    }

    console.log(`Row ${rowNum} Robust Parse Result:`, { title, price, isClosed, statusText: isClosed ? '欠品' : '販売中' });
}
