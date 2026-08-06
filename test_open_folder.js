const { exec } = require('child_process');
const fs = require('fs');

const folder = 'C:\\Users\\akata\\OneDrive\\デスクトップ\\商管どん_商品画像';
if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
}

console.log('Testing start command for folder:', folder);
exec(`start "" "${folder}"`, { shell: 'cmd.exe' }, (err) => {
    if (err) console.error('Start cmd error:', err.message);
    else console.log('Successfully opened with start command!');
});
