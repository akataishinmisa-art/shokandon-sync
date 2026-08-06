const fs = require('fs');
const html = fs.readFileSync('mercari_debug.html', 'utf8');

// Find item price in Mercari RSC payload
// E.g. "price":12800 or \"price\":12800 or "price": 3100
const rscMatch = html.match(/\\"price\\":\s*([0-9]+)/) ||
                 html.match(/"price":\s*([0-9]+)/) ||
                 html.match(/\\"price\\":\\"([0-9]+)\\"/) ||
                 html.match(/price\\":\s*([0-9]+)/);

console.log('RSC Match:', rscMatch);
