const { execSync } = require('child_process');

const psScript = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('C:\\Users\\akata\\Desktop\\商管どん.lnk')
$sc.TargetPath = 'C:\\Users\\akata\\Desktop\\商管どん.bat'
$sc.IconLocation = 'shell32.dll,13'
$sc.Save()
`;

require('fs').writeFileSync('create_sc.ps1', psScript, 'utf8');
try {
    execSync('powershell -ExecutionPolicy Bypass -File create_sc.ps1', { stdio: 'inherit' });
    console.log('Shortcut created successfully!');
} catch (e) {
    console.error('Error:', e.message);
}
