const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'row9_mercari.html'), 'utf-8');

console.log('html.includes("ITEM_STATUS_SOLDOUT"):', html.includes('ITEM_STATUS_SOLDOUT'));
console.log('html.includes("isSoldOut":true):', html.includes('"isSoldOut":true'));

// Search where ITEM_STATUS_SOLDOUT appears
const matches = [...html.matchAll(/ITEM_STATUS_SOLDOUT/g)];
console.log(`Found ${matches.length} occurrences of ITEM_STATUS_SOLDOUT`);

matches.forEach((m, idx) => {
    const start = Math.max(0, m.index - 100);
    const end = Math.min(html.length, m.index + 100);
    console.log(`--- Match ${idx+1} ---`);
    console.log(html.substring(start, end));
});
