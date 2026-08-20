const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    let executablePath = '/usr/bin/google-chrome';
    if (!fs.existsSync(executablePath)) executablePath = '/usr/bin/chromium';

    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1400,900'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const url = 'https://jp.mercari.com/item/m68792414248';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

    const analysis = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;

        // 1. JSON-LD Schema.org Check
        let jsonLdStatus = false;
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        jsonLdScripts.forEach(script => {
            try {
                const json = JSON.parse(script.textContent);
                const str = JSON.stringify(json);
                if (str.includes('OutOfStock') || str.includes('Discontinued') || str.includes('SoldOut')) {
                    jsonLdStatus = true;
                }
            } catch (e) {}
        });

        // 2. Next Data Check
        let nextDataStatus = false;
        const nextDataScript = document.querySelector('script[id="__NEXT_DATA__"]');
        if (nextDataScript) {
            const txt = nextDataScript.textContent;
            if (txt.includes('ITEM_STATUS_SOLDOUT') || txt.includes('ITEM_STATUS_TRADING') || txt.includes('"isSoldOut":true') || txt.includes('"status":"ITEM_STATUS_SOLDOUT"')) {
                nextDataStatus = true;
            }
        }

        // 3. Raw HTML String Search
        const rawHtmlHasSold = html.includes('OutOfStock') || html.includes('ITEM_STATUS_SOLDOUT') || html.includes('ITEM_STATUS_TRADING') || html.includes('"isSoldOut":true');

        return {
            jsonLdStatus,
            nextDataStatus,
            rawHtmlHasSold,
            isClosed: Boolean(jsonLdStatus || nextDataStatus || rawHtmlHasSold)
        };
    });

    console.log('VPS MERCARI FIX TEST FOR m68792414248:', JSON.stringify(analysis, null, 2));
    await browser.close();
})();
