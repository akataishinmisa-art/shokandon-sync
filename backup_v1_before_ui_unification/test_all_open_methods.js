const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const candidates = [
    'C:\\Users\\akata\\OneDrive\\デスクトップ\\商管どん_商品画像',
    'C:\\Users\\akata\\Desktop\\商管どん_商品画像'
];

let targetFolder = '';
for (const dir of candidates) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        targetFolder = dir;
        break;
    } catch (e) {}
}

console.log('Target folder to open:', targetFolder);

// Method 1: powershell Invoke-Item
console.log('Testing Method 1: PowerShell Invoke-Item...');
exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Item -Path '${targetFolder}'"`, (err, stdout, stderr) => {
    console.log('Method 1 Result:', { err: err ? err.message : null, stdout, stderr });
});

// Method 2: cmd.exe start
console.log('Testing Method 2: CMD start...');
exec(`start "" "${targetFolder}"`, { shell: 'cmd.exe' }, (err, stdout, stderr) => {
    console.log('Method 2 Result:', { err: err ? err.message : null, stdout, stderr });
});

// Method 3: explorer.exe direct
console.log('Testing Method 3: Explorer direct...');
exec(`explorer.exe "${targetFolder}"`, (err, stdout, stderr) => {
    console.log('Method 3 Result:', { err: err ? err.message : null, stdout, stderr });
});
