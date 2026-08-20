const puppeteer = require('puppeteer-core');

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const url = 'https://auctions.yahoo.co.jp/jp/auction/j1228620924';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

    const domData = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const isNotFound = bodyText.includes('指定されたオークションは存在しません') || bodyText.includes('該当のオークションは見つかりません');
        const isEnded = bodyText.includes('このオークションは終了しました') || bodyText.includes('オークションは終了') || bodyText.includes('落札されました');

        const titleEl = document.querySelector('h1') || document.querySelector('.ProductTitle__text') || document.querySelector('[class*="ProductTitle"]');
        let t = titleEl ? titleEl.textContent.trim() : document.title.replace(/^Yahoo!オークション\s*-\s*/i, '').trim();

        let p = '';
        const priceEl = document.querySelector('.Price__value') || document.querySelector('[class*="Price__value"]');
        if (priceEl) {
            const clean = priceEl.textContent.replace(/[^0-9]/g, '');
            if (clean) p = parseInt(clean, 10).toLocaleString('ja-JP') + '円';
        }
        if (!p) {
            const mPrice = bodyText.match(/(?:現在|即決|価格)\s*[¥￥]?\s*([0-9,]+)\s*円/);
            if (mPrice) {
                const clean = mPrice[1].replace(/[^0-9]/g, '');
                if (clean) p = parseInt(clean, 10).toLocaleString('ja-JP') + '円';
            }
        }

        return { t, p, isNotFound, isEnded };
    });

    console.log('Yahoo Auction Scraping Test Result:', domData);
    await browser.close();
})();
