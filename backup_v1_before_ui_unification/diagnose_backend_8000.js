const http = require('http');

function getJson(path) {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:8000' + path, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
            });
        }).on('error', reject);
    });
}

function postJson(path, bodyData) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(bodyData || {});
        const req = http.request({
            hostname: 'localhost',
            port: 8000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, raw: data }); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function diagnoseBackend() {
    console.log('🔍 仕入れ監視システム バックエンド (port 8000) 深層診断中...');
    
    // 1. Get targets
    try {
        const targets = await getJson('/api/targets');
        console.log(`✅ 1. /api/targets 取得成功 (${Array.isArray(targets) ? targets.length : 0}件)`);
        if (Array.isArray(targets) && targets.length > 0) {
            const first = targets[0];
            console.log(`   先頭商品: ID=${first.id}, Name=${first.name}, Keyword=${first.keyword}`);

            // 2. Test check endpoint for this item
            console.log(`\n🧪 2. /api/targets/${first.id}/check を直接POSTテスト中...`);
            const startTime = Date.now();
            const checkRes = await postJson(`/api/targets/${first.id}/check?search_mode=recent`, {});
            const duration = Date.now() - startTime;
            console.log(`   ステータスコード: ${checkRes.status} (所要時間: ${duration}ms)`);
            console.log('   レスポンスボディ:', checkRes.body || checkRes.raw);
        } else {
            console.log('⚠️ ターゲット商品が0件です。');
        }
    } catch(e) {
        console.error('❌ バックエンド接続エラー:', e.message);
    }
}

diagnoseBackend();
