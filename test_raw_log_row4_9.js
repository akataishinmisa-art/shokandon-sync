const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

function getExecutablePath() {
    if (process.platform === 'linux') return '/usr/bin/chromium';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

(async () => {
    console.log("=== [RAW EXECUTION LOG - ROW 4 & ROW 9 SCRAPING RESULT] ===");
    
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const targets = [
        { row: 4, name: "Panasonic LUMIX DMC-FX77", url: "https://jp.mercari.com/item/m41184150225" },
        { row: 9, name: "キティ hello kitty ご当地 根付け", url: "https://jp.mercari.com/item/m67212707146" }
    ];

    for (const item of targets) {
        console.log(`\n--------------------------------------------------`);
        console.log(`[LOG STAMP: ${new Date().toISOString()}]`);
        console.log(`Processing Row ${item.row}: ${item.name}`);
        console.log(`Processing URL: ${item.url}`);

        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

        const html = await page.content();
        
        // 1. RAW DOM Evaluation Result
        const domInfo = await page.evaluate(() => {
            const titleEl = document.querySelector('h1') || document.querySelector('[data-testid="item-name"]');
            const priceEl = document.querySelector('[data-testid="product-price"]') || document.querySelector('[class*="price"]');
            const soldBadge = document.querySelector('[data-testid="item-sold-out-badge"]');
            const checkoutBtn = document.querySelector('[data-testid="checkout-button"]');

            return {
                domTitle: titleEl ? titleEl.textContent.trim() : '',
                domPrice: priceEl ? priceEl.textContent.trim() : '',
                hasSoldOutBadge: Boolean(soldBadge),
                checkoutButtonExists: Boolean(checkoutBtn),
                checkoutButtonDisabled: checkoutBtn ? checkoutBtn.disabled : false,
                checkoutButtonText: checkoutBtn ? checkoutBtn.textContent.trim() : ''
            };
        });

        // 2. RAW NEXT_DATA JSON Parsing
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
        let nextDataItemStatus = "NOT_FOUND";
        let nextDataPrice = "";
        let nextDataName = "";

        if (nextDataMatch) {
            try {
                const json = JSON.parse(nextDataMatch[1]);
                const itemObj = (json.props && json.props.pageProps && (json.props.pageProps.item || (json.props.pageProps.initialState && json.props.pageProps.initialState.item))) || null;
                if (itemObj) {
                    nextDataItemStatus = itemObj.status; // e.g. ITEM_STATUS_ON_SALE
                    nextDataPrice = itemObj.price;
                    nextDataName = itemObj.name;
                }
            } catch (e) {}
        }

        // 3. Loose Keyword Check in whole HTML (The Flawed Logic)
        const containsIsSoldOutTrue = html.includes('"isSoldOut":true');
        const containsItemStatusSoldout = html.includes('ITEM_STATUS_SOLDOUT');

        console.log(`[RAW LOG Output] -> DOM Title: "${domInfo.domTitle}"`);
        console.log(`[RAW LOG Output] -> DOM Price: "${domInfo.domPrice}"`);
        console.log(`[RAW LOG Output] -> DOM SoldOut Badge Exists: ${domInfo.hasSoldOutBadge}`);
        console.log(`[RAW LOG Output] -> Checkout Button Text: "${domInfo.checkoutButtonText}" (Disabled: ${domInfo.checkoutButtonDisabled})`);
        console.log(`[RAW LOG Output] -> __NEXT_DATA__ Target Item Status: "${nextDataItemStatus}" (Price: ${nextDataPrice})`);
        console.log(`[RAW LOG Output] -> Full HTML String Contains '"isSoldOut":true': ${containsIsSoldOutTrue}`);
        console.log(`[RAW LOG Output] -> Full HTML String Contains 'ITEM_STATUS_SOLDOUT': ${containsItemStatusSoldout}`);

        if (containsIsSoldOutTrue || containsItemStatusSoldout) {
            console.log(`[RAW LOG OVERRIDE] -> ⚠️ FLAGGED AS '欠品' (Due to whole HTML string matching related items)`);
        } else {
            console.log(`[RAW LOG OVERRIDE] -> ✅ FLAGGED AS '販売中'`);
        }

        await page.close();
    }

    await browser.close();
})();
