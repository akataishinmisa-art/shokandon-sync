const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            if (!f.includes('node_modules') && !f.includes('.git')) searchFiles(full);
        } else if (f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.css')) {
            const txt = fs.readFileSync(full, 'utf8');
            // Look for SVG, floating buttons, fixed position, circular buttons, icons
            if (txt.includes('fixed') || txt.includes('absolute') || txt.includes('circle') || txt.includes('round') || txt.includes('svg')) {
                const lines = txt.split('\n');
                lines.forEach((line, i) => {
                    if (line.includes('fixed') || line.includes('flex-direction: column') || line.includes('button') || line.includes('border-radius: 50%') || line.includes('border-radius: 50%')) {
                        if (line.includes('top:') || line.includes('right:') || line.includes('bottom:') || line.includes('left:') || line.includes('z-index') || line.includes('button') || line.includes('svg') || line.includes('icon')) {
                            console.log(`${full}:${i+1}: ${line.trim().substring(0, 100)}`);
                        }
                    }
                });
            }
        }
    }
}

searchFiles('C:\\Users\\akata\\.gemini\\antigravity\\scratch');
