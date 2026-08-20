const http = require('http');

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

async function testPlatforms() {
    console.log('🔍 各プラットフォームの取得状況をテスト中...');
    const res = await postJson('/api/targets/17/check?search_mode=recent&ignore_max_price=true', {});
    console.log('Result status:', res.status);
    if (res.body && res.body.new_detections) {
        console.log(`検出数: ${res.body.new_detections.length} 件`);
        const platforms = {};
        res.body.new_detections.forEach(item => {
            platforms[item.platform] = (platforms[item.platform] || 0) + 1;
        });
        console.log('プラットフォーム内訳:', platforms);
        console.log('全検出アイテム一覧:');
        res.body.new_detections.forEach((item, idx) => {
            console.log(`  [${idx+1}] プラットフォーム: ${item.platform} | タイトル: ${item.title} | 価格: ¥${item.price_jpy}`);
        });
    } else {
        console.log('Response body:', res.body);
    }
}

testPlatforms();
