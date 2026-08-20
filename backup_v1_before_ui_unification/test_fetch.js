const https = require('https');

const url = 'https://static.mercdn.net/item/detail/orig/photos/m62808756184_1.jpg';
console.log('Testing HTTP GET for:', url);

const req = https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://jp.mercari.com/'
    }
}, (res) => {
    console.log('Status code:', res.statusCode);
    console.log('Headers:', res.headers);
});

req.on('error', (err) => console.error('Error:', err.message));
