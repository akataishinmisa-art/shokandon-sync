const fs = require('fs');

const logPath = 'C:\\Users\\akata\\.gemini\\antigravity\\brain\\4cc3ac48-84d8-418f-b010-799d05619911\\.system_generated\\logs\\transcript.jsonl';

if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('API') || line.includes('開発') || line.includes('取得') || line.includes('申請') || line.includes('NTT') || line.includes('eBay')) {
            try {
                const obj = JSON.parse(line);
                if (obj.type === 'USER_INPUT') {
                    console.log(`Line ${idx} [USER_INPUT]:`, JSON.stringify(obj.content));
                } else if (obj.type === 'PLANNER_RESPONSE' && (line.includes('API') || line.includes('NTT'))) {
                    console.log(`Line ${idx} [PLANNER_RESPONSE]:`, JSON.stringify(obj.content).substring(0, 300));
                }
            } catch (e) {}
        }
    });
}
