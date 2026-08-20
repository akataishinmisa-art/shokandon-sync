const { execSync, spawn } = require('child_process');

try {
    const stdout = execSync('netstat -ano | findstr :3000').toString();
    const lines = stdout.split('\n').filter(l => l.includes('LISTENING'));
    for (const l of lines) {
        const parts = l.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
            console.log(`Killing old PID: ${pid}`);
            try { execSync(`taskkill /F /PID ${pid}`); } catch (e) {}
        }
    }
} catch (e) {}

console.log('Starting fresh server.js...');
const proc = spawn('node', ['server.js'], {
    cwd: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch',
    detached: true,
    stdio: 'ignore',
    shell: true
});
proc.unref();
console.log('Server started successfully.');
