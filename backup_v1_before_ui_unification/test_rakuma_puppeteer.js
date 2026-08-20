const puppeteer = require('puppeteer');
const fs = require('fs');

function getExecutablePath() {
    if (process.platform === 'linux') return '/usr/bin/chromium';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

async function testRakumaFull() {
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    const url = 'https://item.fril.jp/22d4c7937f576d2d652ad56a192d6d2e';
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

        const html = await page.content();
        const info = await page.evaluate((targetUrl) => {
            let title = '';
            let price = '';
            let isClosed = false;

            const bodyText = document.body.innerText || '';
            const isDeleted = bodyText.includes('該当の商品は削除されました') ||
                              bodyText.includes('商品が見つかりませんでした') ||
                              bodyText.includes('この商品は削除されました') ||
                              bodyText.includes('指定されたページは見つかりませんでした');

            const titleEl = document.querySelector('.item__name') ||
                            document.querySelector('[class*="item__name"]') ||
                            document.querySelector('.item-header__name') ||
                            document.querySelector('h1');
            title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\s*-\s*ラクマ.*/i, '').trim();

            if (isDeleted || title.includes('フリマアプリ ラクマ')) {
                isClosed = true;
                if (!title || title.includes('フリマアプリ')) {
                    title = '欠品（削除された商品）';
                }
            } else {
                const priceEl = document.querySelector('[itemprop="price"]') ||
                                document.querySelector('.item__price') ||
                                document.querySelector('.item-price') ||
                                document.querySelector('[class*="item__price"]');
                let rawPrice = priceEl ? (priceEl.getAttribute('content') || priceEl.textContent.trim()) : '';
                const cleanNum = rawPrice.replace(/[^0-9]/g, '');
                if (cleanNum) {
                    price = parseInt(cleanNum, 10).toLocaleString('ja-JP') + '円';
                }

                const soldoutBadge = document.querySelector('.item__badge--soldout') ||
                                     document.querySelector('[class*="soldout"]') ||
                                     document.querySelector('[class*="SOLD"]') ||
                                     Array.from(document.querySelectorAll('*')).find(el => {
                                         const t = el.children.length === 0 ? el.textContent.trim() : '';
                                         return t === 'SOLDOUT' || t === 'SOLD OUT' || t === '売り切れ' || t === '売り切れました';
                                     });

                const purchaseBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('購入に進む'));

                isClosed = Boolean(soldoutBadge || !purchaseBtn);
            }

            const statusText = isClosed ? '欠品' : '販売中';
            return { title, price, isClosed, statusText };
        }, url);

        console.log('DOM Evaluation Result:', info);

        // Check fallback HTML parsing
        if (!info.title || info.title.includes('ラクマ')) {
            const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
            if (ogTitle) console.log('HTML Backup og:title:', ogTitle[1]);
        }
        if (!info.price) {
            const priceMatch = html.match(/<meta\s+property="product:price:amount"\s+content="([0-9]+)"/i) || html.match(/"price":([0-9]+)/);
            if (priceMatch) console.log('HTML Backup price:', priceMatch[1]);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
}

testRakumaFull();
