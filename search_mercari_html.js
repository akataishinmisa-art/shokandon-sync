const fs = require('fs');
const html = fs.readFileSync('mercari_debug.html', 'utf8');

// Find all matches for price in Mercari HTML
const matches = [];
const reg = /"price":\s*([0-9]+)|"price"\s*:\s*"([0-9]+)"|price:([0-9]+)|"value":\s*([0-9]+)|"priceText":\s*"([^"]+)"|¥\s*([0-9,]+)|￥\s*([0-9,]+)/g;
let m;
while ((m = reg.exec(html)) !== null) {
    matches.push(m[0]);
}

console.log('Price matches in Mercari HTML:', matches.slice(0, 20));
