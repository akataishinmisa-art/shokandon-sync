const fs = require('fs');
const path = require('path');

const transcriptPath = path.join('C:\\Users\\akata\\.gemini\\antigravity\\brain\\77cbc69e-8b3e-492c-b1c3-0cd099179c6d\\.system_generated\\logs\\transcript.jsonl');

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
console.log('=== EXACT EXECUTIONS TODAY (2026-08-16) AFTER 09:40 JST ===\n');

lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const contentStr = JSON.stringify(obj);

        if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
                if (tc.name === 'run_command' && tc.args && tc.args.CommandLine) {
                    const cmd = tc.args.CommandLine;
                    if (cmd.includes('node')) {
                        console.log(`[Step ${idx + 1}]: ${cmd}`);
                    }
                }
            }
        }
    } catch (e) {}
});
