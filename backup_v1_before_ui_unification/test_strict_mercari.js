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

    const urls = [
        { name: 'Active Item (Row 11)', url: 'https://jp.mercari.com/item/m93639973805' },
        { name: 'Sold Out Item (Row 27)', url: 'https://jp.mercari.com/item/m68792414248' }
    ];

    for (const u of urls) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(u.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

        const res = await page.evaluate(() => {
            let jsonLdStatus = false;
            const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            jsonLdScripts.forEach(script => {
                try {
                    const json = JSON.parse(script.textContent);
                    const str = JSON.stringify(json);
                    if (str.includes('schema.org/OutOfStock') || str.includes('schema.org/SoldOut') || str.includes('"availability":"OutOfStock"') || str.includes('"availability":"https://schema.org/OutOfStock"')) {
                        jsonLdStatus = true;
                    }
                } catch (e) {}
            });

            let nextDataStatus = false;
            const nextDataScript = document.querySelector('script[id="__NEXT_DATA__"]');
            if (nextDataScript) {
                try {
                    const nextJson = JSON.parse(nextDataScript.textContent);
                    const itemObj = (nextJson.props && nextJson.props.pageProps && (nextJson.props.pageProps.item || (nextJson.props.pageProps.initialState && nextJson.props.pageProps.initialState.item))) || null;
                    if (itemObj) {
                        if (itemObj.status === 'ITEM_STATUS_SOLDOUT' || itemObj.status === 'ITEM_STATUS_TRADING' || itemObj.isSoldOut === true) {
                            nextDataStatus = true;
                        }
                    }
                } catch (e) {}
            }

            const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
            const hasSoldoutBtn = allButtons.some(b => {
                const txt = (b.textContent || '').trim();
                return txt === '売り切れました' || txt === 'SOLD OUT' || txt === 'この商品は売り切れました';
            });

            const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') ||
                              document.querySelector('div[aria-label*="売り切れ"]');

            const isClosed = Boolean(jsonLdStatus || nextDataStatus || hasSoldoutBtn || soldBadge);

            return { jsonLdStatus, nextDataStatus, hasSoldoutBtn, hasSoldBadge: Boolean(soldBadge), isClosed };
        });

        console.log(`${u.name} Result:`, JSON.stringify(res, null, 2));
        await page.close();
    }

    await browser.close();
})();
