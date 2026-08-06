const http = require('http');

http.get('http://localhost:8085/api/lookup-product-db?mpn=PCH-2000', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Server response for PCH-2000:', data));
});
