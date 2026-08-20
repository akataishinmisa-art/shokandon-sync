const http = require('http');

http.get('http://localhost:3000/api/status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('isRunning:', json.isRunning);
        console.log('Total log length:', json.logs.length);
        const lines = json.logs.split('\n');
        console.log('First 5 lines:\n', lines.slice(0, 5).join('\n'));
        console.log('Last 10 lines:\n', lines.slice(-10).join('\n'));
    });
});
