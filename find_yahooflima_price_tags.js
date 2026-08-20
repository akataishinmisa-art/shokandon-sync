const fs = require('fs');

const html = fs.readFileSync('row_32_yahooflima.html', 'utf8');

const matches = [];
const regex = /14,?240/g;
let match;
while ((match = regex.exec(html)) !== null) {
    const start = Math.max(0, match.index - 100);
    const end = Math.min(html.length, match.index + 100);
    matches.push(html.substring(start, end));
}

console.log(`Found ${matches.length} matches for price 14240 in row_32_yahooflima.html:`);
matches.slice(0, 5).forEach((m, idx) => {
    console.log(`\n--- Match ${idx + 1} ---`);
    console.log(m);
});
