const https = require('https');
const fs = require('fs');

const url = 'https://www.ebay.com/sch/i.html?_nkw=PCH-2000&LH_Sold=1&LH_Complete=1';
const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
};

https.get(url, options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay_search_debug.html', data, 'utf8');
        console.log('Saved html length:', data.length);
        const matches = data.match(/\$[0-9,.]+/g);
        console.log('Dollar matches count:', matches ? matches.length : 0);
        if (matches) console.log('Sample dollar matches:', matches.slice(0, 15));
    });
});
