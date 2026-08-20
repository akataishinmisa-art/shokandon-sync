const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const https = require('https');

const sampleUrl = 'https://paypayfleamarket.yahoo.co.jp/item/z328124234'; // Or any active Yahoo fleamarket item

function getExecutablePath() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

(async () => {
    console.log(`Fetching Yahoo Fleamarket URL: ${sampleUrl}`);
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(sampleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(res => setTimeout(res, 3000)));

    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, 'yahooflima_sample.html'), html);
    console.log(`Saved yahooflima_sample.html (${html.length} bytes)`);

    const result = await page.evaluate(() => {
        const titleEl = document.querySelector('h1') || document.querySelector('[class*="ItemTitle_title"]') || document.querySelector('[class*="title"]');
        const title = titleEl ? titleEl.textContent.trim() : document.title;

        const priceEl = document.querySelector('[class*="ItemPrice_price"]') ||
                        document.querySelector('[class*="price"]') ||
                        document.querySelector('[class*="Price"]');
        const price = priceEl ? priceEl.textContent.trim() : '';

        const imgs = Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src && !src.includes('ogp') && !src.includes('icon') && !src.includes('logo') && !src.includes('banner'));

        const metaPrice = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"]');
        const metaPriceVal = metaPrice ? metaPrice.getAttribute('content') : '';

        const ogImg = document.querySelector('meta[property="og:image"]');
        const ogImgVal = ogImg ? ogImg.getAttribute('content') : '';

        return {
            title,
            price,
            metaPriceVal,
            ogImgVal,
            imgs: imgs.slice(0, 5)
        };
    });

    console.log('Scraped Result:', result);

    // Check __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (nextDataMatch) {
        console.log('Found __NEXT_DATA__!');
        try {
            const json = JSON.parse(nextDataMatch[1]);
            fs.writeFileSync(path.join(__dirname, 'yahooflima_nextdata.json'), JSON.stringify(json, null, 2));
            console.log('Saved yahooflima_nextdata.json');
        } catch (e) {
            console.error('JSON parse error:', e.message);
        }
    } else {
        console.log('__NEXT_DATA__ not found');
    }

    await browser.close();
})();
