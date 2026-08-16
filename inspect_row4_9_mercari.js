const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

function getExecutablePath() {
    if (process.platform === 'linux') return '/usr/bin/chromium';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const urls = [
        { row: 4, url: 'https://jp.mercari.com/item/m41184150225' },
        { row: 9, url: 'https://jp.mercari.com/item/m67212707146' }
    ];

    for (const u of urls) {
        console.log(`\n================ Inspecting Row ${u.row}: ${u.url} ================`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(u.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));

        const html = await page.content();
        
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
        let nextDataObj = null;
        if (nextDataMatch) {
            try {
                nextDataObj = JSON.parse(nextDataMatch[1]);
            } catch (e) {}
        }

        const domStatus = await page.evaluate(() => {
            const titleEl = document.querySelector('h1') || document.querySelector('[data-testid="item-name"]');
            const title = titleEl ? titleEl.textContent.trim() : '';

            const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]') || document.querySelector('div[aria-label*="売り切れ"]');
            const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');
            const btnText = checkoutBtn ? checkoutBtn.textContent.trim() : '';
            const isBtnDisabled = checkoutBtn ? checkoutBtn.disabled : false;

            const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
            const price = priceEl ? priceEl.textContent.trim() : '';

            return {
                title,
                price,
                hasSoldBadge: Boolean(soldBadge),
                soldBadgeText: soldBadge ? soldBadge.textContent.trim() : '',
                btnText,
                isBtnDisabled
            };
        });

        console.log(`[DOM Status Check]:`, domStatus);

        if (nextDataObj) {
            const itemObj = (nextDataObj.props && nextDataObj.props.pageProps && (nextDataObj.props.pageProps.item || (nextDataObj.props.pageProps.initialState && nextDataObj.props.pageProps.initialState.item))) || null;
            console.log(`[__NEXT_DATA__ Item Status]:`, itemObj ? { id: itemObj.id, name: itemObj.name, price: itemObj.price, status: itemObj.status } : 'Not Found');
        }

        console.log(`[HTML Keyword Check]:`, {
            includesIsSoldOutTrue: html.includes('"isSoldOut":true'),
            includesItemStatusSoldout: html.includes('ITEM_STATUS_SOLDOUT')
        });

        await page.close();
    }

    await browser.close();
})();
