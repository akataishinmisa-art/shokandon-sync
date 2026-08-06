const https = require('https');

const url = 'https://www.ebay.com/sch/i.html?_nkw=Nikon+COOLPIX+P900&_rss=1';
const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
};

https.get(url, options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('RSS Status:', res.statusCode);
        console.log('RSS Length:', data.length);
        const titles = data.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/gi) || [];
        console.log('Titles found:', titles.slice(0, 10));
    });
}).on('error', err => console.error('Error:', err.message));
