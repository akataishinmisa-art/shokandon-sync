const fs = require('fs');
const html = fs.readFileSync('m73194523815.html', 'utf8');

const m = html.match(/product:price:amount["'],\s*["']content["']:\s*["']([0-9]+)["']/i) ||
          html.match(/content["']:\s*["']([0-9]+)["'],\s*["']product:price:amount["']/i) ||
          html.match(/product:price:amount["'][^>]*content=["']([0-9]+)["']/i) ||
          html.match(/content=["']([0-9]+)["'][^>]*product:price:amount["']/i);

console.log('Mercari meta price match:', m ? m[1] : null);
