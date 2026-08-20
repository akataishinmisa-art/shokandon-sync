const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    let executablePath = '/usr/bin/google-chrome';
    if (!fs.existsSync(executablePath)) executablePath = '/usr/bin/chromium';

    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Row 27 (Sold Out)
    await page.goto('https://jp.mercari.com/item/m68792414248', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const soldoutScripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script')).map(s => ({
            id: s.id,
            type: s.type,
            textSnippet: s.textContent.slice(0, 300)
        })).filter(s => s.textSnippet.includes('status') || s.textSnippet.includes('price') || s.textSnippet.includes('availability') || s.textSnippet.includes('item'));
    });

    console.log('Sold Out Item (m68792414248) Scripts:', JSON.stringify(soldoutScripts, null, 2));

    // Row 11 (Active)
    await page.goto('https://jp.mercari.com/item/m93639973805', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const activeScripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script')).map(s => ({
            id: s.id,
            type: s.type,
            textSnippet: s.textContent.slice(0, 300)
        })).filter(s => s.textSnippet.includes('status') || s.textSnippet.includes('price') || s.textSnippet.includes('availability') || s.textSnippet.includes('item'));
    });

    console.log('\nActive Item (m93639973805) Scripts:', JSON.stringify(activeScripts, null, 2));

    await browser.close();
})();
