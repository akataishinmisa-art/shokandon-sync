const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const linuxChromePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const executablePath = fs.existsSync(linuxChromePath) ? linuxChromePath : (fs.existsSync(chromePath) ? chromePath : edgePath);

(async () => {
    console.log('[Test Scrape] Executable Path:', executablePath);
    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const testUrls = [
        'https://jp.mercari.com/item/m39524434148',
        'https://www.amazon.co.jp/dp/B001RLZ94S',
        'https://paypayfleamarket.yahoo.co.jp/item/z65154378'
    ];

    for (const url of testUrls) {
        console.log(`\n--- Testing ${url} ---`);
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        try {
            const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            console.log('HTTP Status:', res ? res.status() : 'No response');
            await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
            const title = await page.title();
            console.log('Page Title:', title);
            const content = await page.content();
            console.log('Content Length:', content.length);
            console.log('Content Snippet:', content.substring(0, 300).replace(/\s+/g, ' '));
        } catch (err) {
            console.error('Error:', err.message);
        } finally {
            await page.close();
        }
    }

    await browser.close();
})();
