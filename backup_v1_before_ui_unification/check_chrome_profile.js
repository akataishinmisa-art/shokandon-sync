const fs = require('fs');
const path = require('path');

const chromeUserData = 'C:\\Users\\akata\\AppData\\Local\\Google\\Chrome\\User Data';
console.log('Chrome User Data Exists:', fs.existsSync(chromeUserData));

if (fs.existsSync(chromeUserData)) {
    try {
        const files = fs.readdirSync(chromeUserData);
        console.log('User Data items:', files.filter(f => f.startsWith('Profile') || f === 'Default'));
    } catch (e) {
        console.error('Error reading Chrome dir:', e);
    }
}
