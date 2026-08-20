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

        const data = await page.evaluate(() => {
            let mainProductOffersAvailability = null;

            const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const script of jsonLdScripts) {
                try {
                    const obj = JSON.parse(script.textContent);
                    const items = Array.isArray(obj) ? obj : [obj];
                    for (const o of items) {
                        if (o && (o['@type'] === 'Product' || o['@type'] === 'ItemPage')) {
                            const offers = o.offers || (o.mainEntity && o.mainEntity.offers);
                            if (offers) {
                                mainProductOffersAvailability = offers.availability || (Array.isArray(offers) ? offers[0].availability : null);
                            }
                        }
                    }
                } catch (e) {}
            }

            // Check NEXT_DATA item status
            let nextDataStatus = null;
            const nextScript = document.querySelector('script[id="__NEXT_DATA__"]');
            if (nextScript) {
                try {
                    const nextJson = JSON.parse(nextScript.textContent);
                    const itemObj = (nextJson.props && nextJson.props.pageProps && (nextJson.props.pageProps.item || (nextJson.props.pageProps.initialState && nextJson.props.pageProps.initialState.item))) || null;
                    if (itemObj) {
                        nextDataStatus = itemObj.status; // 'ITEM_STATUS_ON_SALE', 'ITEM_STATUS_SOLDOUT', etc.
                    }
                } catch (e) {}
            }

            return {
                mainProductOffersAvailability,
                nextDataStatus
            };
        });

        console.log(`\n=== ${item.name} (${item.url}) ===`);
        console.log(JSON.stringify(data, null, 2));
        await page.close();
    }

    await browser.close();
})();
