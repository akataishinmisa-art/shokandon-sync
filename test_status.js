const http = require('http');

const req = http.request('http://localhost:3000/api/status', {
    method: 'GET'
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status Response:', data);
    });
});

req.end();
