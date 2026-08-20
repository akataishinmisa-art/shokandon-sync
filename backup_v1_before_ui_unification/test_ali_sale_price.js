const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://ja.aliexpress.com/item/1005010369091586.html?sourceType=562&pvid=f893ded7-5484-402d-a4e3-edc13ba3cc2f&pdp_ext_f=%7B%22ship_from%22%3A%22CN%22%2C%22sku_id%22%3A%2212000052160646579%22%7D&scm=1007.28480.422277.0&scm-url=1007.28480.422277.0&scm_id=1007.28480.422277.0&pdp_npi=6%40dis%21JPY%21%EF%BF%A5+14%2C140%21%EF%BF%A5+6%2C646%21%21%21574.25%21269.90%21%400b08c0c217851616686983550e0f74%2112000052160646579%21dsg%21JP%213740295337%21X%211%210%21n_tag%3A-29919%3Bc%3A562%3Bd%3A561ca97f%3Bm03_new_user%3A-29895&spm=a2g0o.tm1000029706.8287340260.d0&aecmd=true';

    console.log('Testing AliExpress sale price extraction logic...');
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

        const result = await page.evaluate(() => {
            let currentPriceEl = document.querySelector('[class*="price"][class*="current"]') ||
                                 document.querySelector('[class*="currentPrice"]') ||
                                 document.querySelector('.product-price-current');

            if (!currentPriceEl) {
                const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent.trim() : '';
                    if (!text.includes('円') || text.length > 20) return false;

                    const style = window.getComputedStyle(el);
                    const isLineThrough = (style.textDecorationLine || '').includes('line-through') || (style.textDecoration || '').includes('line-through');
                    const isSavings = text.includes('お得') || text.includes('OFF') || text.includes('引き');

                    return !isLineThrough && !isSavings;
                });

                if (candidates.length > 0) {
                    candidates.sort((a, b) => parseFloat(window.getComputedStyle(b).fontSize) - parseFloat(window.getComputedStyle(a).fontSize));
                    currentPriceEl = candidates[0];
                }
            }

            let price = currentPriceEl ? currentPriceEl.textContent.trim() : '';
            if (price.includes('円')) {
                const match = price.match(/([0-9,]+円)/);
                price = match ? match[1] : price;
            }

            return { extractedPrice: price, elementText: currentPriceEl ? currentPriceEl.textContent.trim() : '' };
        });

        console.log('Extraction Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
})();
