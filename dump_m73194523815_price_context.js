const fs = require('fs');
const html = fs.readFileSync('m73194523815.html', 'utf8');

// Find all matches of price in html
let pos = 0;
while (true) {
    const idx = html.toLowerCase().indexOf('price', pos);
    if (idx === -1) break;
    console.log(`\nMatch at ${idx}:`);
    console.log(html.substring(Math.max(0, idx - 40), Math.min(html.length, idx + 80)));
    pos = idx + 5;
}
