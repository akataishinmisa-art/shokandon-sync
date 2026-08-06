const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sourceUserData = 'C:\\Users\\akata\\AppData\\Local\\Google\\Chrome\\User Data';
const targetUserData = 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\chrome_temp_profile';

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    try {
        const files = fs.readdirSync(from);
        for (const file of files) {
            if (file === 'Cache' || file === 'Code Cache' || file === 'GPUCache' || file === 'Crashpad') continue;
            const current = path.join(from, file);
            const target = path.join(to, file);
            if (fs.statSync(current).isDirectory()) {
                copyFolderSync(current, target);
            } else {
                fs.copyFileSync(current, target);
            }
        }
    } catch (e) {
        // Skip locked files
    }
}

(async () => {
    console.log('Copying user profile session...');
    copyFolderSync(sourceUserData, targetUserData);
    console.log('Copy completed.');

    console.log('Launching browser with copied profile...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        userDataDir: targetUserData,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--profile-directory=Default',
            '--window-size=1400,900'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    console.log('Navigating to eBay Active Listings / Seller Hub...');
    await page.goto('https://www.ebay.com/sh/lst/active', { waitUntil: 'networkidle2', timeout: 60000 });

    const currentUrl = page.url();
    console.log('Opened URL:', currentUrl);

    await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay_login_status.png' });

    const isLoginRequired = currentUrl.includes('signin') || currentUrl.includes('login');
    console.log('Is Login Page:', isLoginRequired);

    await browser.close();
})();
