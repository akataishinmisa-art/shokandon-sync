const http = require('http');

http.get('http://localhost:8000/api/targets', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('API /api/targets status:', res.statusCode);
        try {
            const parsed = JSON.parse(data);
            console.log('Target count:', parsed.length);
            if (parsed.length > 0) {
                console.log('First 3 targets:', parsed.slice(0, 3));
            }
        } catch(e) {
            console.log('Raw response:', data);
        }
    });
});
