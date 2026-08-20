const http = require('http');

http.get('http://localhost:3000/api/status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const logs = json.logs || '';
        const lines = logs.split('\n');
        
        console.log('=== All Schedule Trigger Lines Found ===');
        lines.forEach((l, idx) => {
            if (l.includes('自動スケジュール同期起動') || l.includes('AutoSchedule') || l.includes('SaaS一元管理同期エンジン起動') || l.includes('処理完了')) {
                console.log(`Line ${idx+1}: ${l}`);
            }
        });
    });
}).on('error', (err) => console.log('Error:', err.message));
