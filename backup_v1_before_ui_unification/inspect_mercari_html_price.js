const fs = require('fs');
const html = fs.readFileSync('mercari_debug.html', 'utf8');

const idx = html.indexOf('"price"');
console.log('Index of "price":', idx);

if (idx !== -1) {
    console.log('Snippet around "price":', html.substring(idx - 50, idx + 100));
} else {
    console.log('No "price" found, checking "price":');
    const idx2 = html.indexOf('price');
    console.log('Index of price:', idx2);
    if (idx2 !== -1) {
        console.log('Snippet around price:', html.substring(idx2 - 50, idx2 + 100));
    }
}
