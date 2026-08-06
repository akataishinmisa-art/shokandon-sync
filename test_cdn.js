const https = require('https');
const fs = require('fs');

const testUrls = [
    'https://static.mercdn.net/c/f=webp,g=0,w=640/thumb/photos/m62808756184_1.jpg',
    'https://static.mercdn.net/item/detail/orig/photos/m62808756184_1.jpg?1785373000',
    'https://static.mercdn.net/thumb/photos/m62808756184_1.jpg'
];

testUrls.forEach((url, i) => {
    const req = https.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://jp.mercari.com/'
        }
    }, (res) => {
        console.log(`URL ${i+1} status:`, res.statusCode);
        if (res.statusCode === 200) {
            const fileStream = fs.createWriteStream(`test_out_${i+1}.webp`);
            res.pipe(fileStream);
            fileStream.on('finish', () => console.log(`Saved test_out_${i+1}.webp`));
        }
    });
    req.on('error', err => console.error(err));
});
