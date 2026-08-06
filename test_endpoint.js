const http = require('http');

const req = http.request('http://localhost:3000/api/test-line', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response:', data);
    });
});

req.write(JSON.stringify({}));
req.end();
