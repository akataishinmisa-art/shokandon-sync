// Wrapper routing to the single unified engine saas_batch_engine.js with --mode=soldout_g
const { spawn } = require('child_process');
const path = require('path');

const targetScript = path.join(__dirname, 'saas_batch_engine.js');
console.log('🔄 Routing process_soldout_g.js to Unified Engine saas_batch_engine.js (--mode=soldout_g)...');

const proc = spawn('node', [targetScript, '--mode=soldout_g', ...process.argv.slice(2)], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
});

proc.on('exit', (code) => {
    process.exit(code || 0);
});
