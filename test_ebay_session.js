const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\akata\\AppData\\Local\\Google\\Chrome\\User Data';

(async () => {
    console.log('Testing eBay logged-in session via user profile...');
    try {
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            userDataDir: userDataDir,
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

        const pageText = await page.evaluate(() => document.body.textContent.trim().substring(0, 300));
        console.log('Page Snippet:', pageText.replace(/\s+/g, ' '));

        await page.screenshot({ path: 'C:\\Users\\akata\\.gemini\\antigravity\\scratch\\ebay_seller_hub.png' });

        await browser.close();
    } catch (err) {
        console.error('Error launching with user profile:', err);
    }
})();
