const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        const req = client.get(targetUrl, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const parsed = new URL(targetUrl);
                    redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
                }
                return fetchUrlHtml(redirectUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(8000, () => {
            req.destroy();
            reject(new Error('URL timeout'));
        });
    });
}

function extractPriceFromHtml(html) {
    if (!html) return '';

    // 1. Mercari __NEXT_DATA__ JSON or product:price:amount
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    if (nextDataMatch) {
        try {
            const json = JSON.parse(nextDataMatch[1]);
            const p = json?.props?.pageProps?.item?.price;
            if (p) return `￥${parseInt(p).toLocaleString()}`;
        } catch (e) {}
    }

    const ogPriceMatch = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([0-9]+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([0-9]+)["'][^>]*property=["']product:price:amount["']/i);
    if (ogPriceMatch && ogPriceMatch[1]) {
        return `￥${parseInt(ogPriceMatch[1]).toLocaleString()}`;
    }

    // 2. Amazon price (apexPriceToPay, priceToPay, a-price-whole)
    const amazonPriceWhole = html.match(/<span class="a-price-whole">([0-9,]+)<span/i) ||
                             html.match(/<span class="a-price-whole">([0-9,]+)/i);
    if (amazonPriceWhole && amazonPriceWhole[1]) {
        const cleanP = amazonPriceWhole[1].replace(/[,.]/g, '');
        if (cleanP) return `￥${parseInt(cleanP).toLocaleString()}`;
    }

    const priceRegexes = [
        /"price"\s*:\s*"?([0-9,]+)"?/,
        /"priceAmount"\s*:\s*"?([0-9,]+)"?/,
        /["']price["']\s*:\s*["']?([0-9,]+)["']?/,
        /￥\s*([0-9,]{3,9})/
    ];

    for (const reg of priceRegexes) {
        const m = html.match(reg);
        if (m && m[1]) {
            const num = parseInt(m[1].replace(/,/g, ''));
            if (!isNaN(num) && num > 50 && num < 10000000) {
                return `￥${num.toLocaleString()}`;
            }
        }
    }

    return '';
}

async function testPrice(url) {
    console.log('\n--- Testing Price Extraction for:', url, '---');
    let price = '';
    try {
        const html = await fetchUrlHtml(url);
        price = extractPriceFromHtml(html);
        console.log('HTTP GET extracted price:', price);
    } catch (e) {
        console.error('HTTP GET error:', e.message);
    }

    if (!price) {
        console.log('Launching Puppeteer fallback for price...');
        let browser = null;
        try {
            browser = await puppeteer.launch({
                executablePath,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });

            price = await page.evaluate(() => {
                // Mercari price DOM
                const mercariPrice = document.querySelector('[data-testid="price"], .merItemPrice, [class*="price"]');
                if (mercariPrice && mercariPrice.textContent) {
                    const m = mercariPrice.textContent.match(/¥\s*([0-9,]+)|￥\s*([0-9,]+)|([0-9,]+)\s*円/);
                    if (m) {
                        const numStr = (m[1] || m[2] || m[3]).replace(/,/g, '');
                        return `￥${parseInt(numStr).toLocaleString()}`;
                    }
                }

                // Amazon price DOM
                const amazonPrice = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #price_inside_buybox, .apexPriceToPay .a-offscreen');
                if (amazonPrice && amazonPrice.textContent) {
                    const m = amazonPrice.textContent.match(/￥\s*([0-9,]+)|¥\s*([0-9,]+)/);
                    if (m) {
                        return `￥${parseInt((m[1]||m[2]).replace(/,/g, '')).toLocaleString()}`;
                    }
                }

                return '';
            });
            console.log('Puppeteer extracted price:', price);
        } catch (err) {
            console.error('Puppeteer error:', err.message);
        } finally {
            if (browser) await browser.close();
        }
    }

    console.log('FINAL RESULT price:', price);
}

(async () => {
    await testPrice('https://jp.mercari.com/item/m73194523883');
    await testPrice('https://www.amazon.co.jp/dp/B001RLZ94S/');
})();
