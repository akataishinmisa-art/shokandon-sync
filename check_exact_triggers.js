const http = require('http');

http.get('http://localhost:3000/api/status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const logs = json.logs || '';
        const lines = logs.split('\n');
        
        console.log('Total log lines:', lines.length);
        console.log('Search for 🚀 or ⏰ icons:');
        lines.forEach((l, idx) => {
            if (l.includes('🚀') || l.includes('⏰') || l.includes('自動スケジュール') || l.includes('SaaS一元管理同期エンジン起動')) {
                console.log(`[Line ${idx+1}]: ${l}`);
            }
        });
    });
});
