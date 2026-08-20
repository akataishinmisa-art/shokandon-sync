const https = require('https');
const fs = require('fs');
const path = require('path');

function getLineToken() {
    try {
        const usersPath = path.join(__dirname, 'users_config.json');
        if (fs.existsSync(usersPath)) {
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            if (users[0] && users[0].lineChannelAccessToken) return users[0].lineChannelAccessToken;
        }
    } catch (e) {}

    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.lineChannelAccessToken) return config.lineChannelAccessToken;
        }
    } catch (e) {}

    return null;
}

const token = getLineToken();

if (!token) {
    console.log('JSON_RESULT:' + JSON.stringify({ error: 'LINE Channel Access Token が見つかりませんでした。' }));
    process.exit(0);
}

// LINE Messaging API: 当月のメッセージ消費数取得エンドポイント
const options = {
    hostname: 'api.line.me',
    path: '/v2/bot/message/quota/consumption',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('JSON_RESULT:' + JSON.stringify({ statusCode: res.statusCode, body: json }));
        } catch (e) {
            console.log('JSON_RESULT:' + JSON.stringify({ statusCode: res.statusCode, raw: data }));
        }
    });
});

req.on('error', (e) => {
    console.log('JSON_RESULT:' + JSON.stringify({ error: e.message }));
});

req.end();
