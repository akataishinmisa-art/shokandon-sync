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

    const testUrls = [
        { name: 'Row 11 (Active)', url: 'https://jp.mercari.com/item/m93639973805' },
        { name: 'Row 27 (Sold Out)', url: 'https://jp.mercari.com/item/m68792414248' }
    ];

    for (const item of testUrls) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

        const res = await page.evaluate(() => {
            const html = document.documentElement.outerHTML;

            // Search for status in RSC chunks
            let status = null;
            let isSoldOut = false;

            const rscMatches = html.match(/"status"\s*:\s*"([^"]+)"/g) || [];
            const rscStatuses = rscMatches.map(m => m.replace(/"status"\s*:\s*"/, '').replace('"', ''));

            const isSoldOutMatch = html.includes('"isSoldOut":true') || html.includes('"isSoldOut": true');

            if (rscStatuses.includes('ITEM_STATUS_SOLDOUT') || rscStatuses.includes('ITEM_STATUS_TRADING') || isSoldOutMatch) {
                isSoldOut = true;
            }

            return {
                rscStatuses,
                isSoldOutMatch,
                isSoldOut
            };
        });

        console.log(`\n=== ${item.name} (${item.url}) ===`);
        console.log(JSON.stringify(res, null, 2));
        await page.close();
    }

    await browser.close();
})();
