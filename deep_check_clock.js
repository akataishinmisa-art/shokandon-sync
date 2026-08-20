const https = require('https');
const { execSync } = require('child_process');

console.log("=== 🔍 Deep Investigation 1: Local Clock vs Google Server Clock ===");

const localNow = Date.now();
const req = https.get('https://www.google.com', (res) => {
    const serverDateStr = res.headers['date'];
    const serverNow = new Date(serverDateStr).getTime();
    const diffMs = localNow - serverNow;
    const diffSec = (diffMs / 1000).toFixed(2);

    console.log(`Local Clock  : ${new Date(localNow).toISOString()}`);
    console.log(`Google Clock : ${new Date(serverNow).toISOString()} (${serverDateStr})`);
    console.log(`Time Difference (Local - Google): ${diffMs} ms (${diffSec} seconds)`);

    if (Math.abs(diffMs) > 30000) {
        console.log(`🚨 CRITICAL TIME DRIFT DETECTED! PC Clock is off by ${diffSec} seconds.`);
    } else {
        console.log(`✅ Clock drift is within normal range (${diffSec}s). Time drift is NOT the cause.`);
    }
});

req.on('error', (e) => {
    console.error("HTTP Request Error:", e.message);
});
