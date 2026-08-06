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

    // 1. Mercari RSC / JSON payload
    const rscPriceMatch = html.match(/\\*"price\\*":\s*([0-9]{3,8})/i) ||
                          html.match(/\\"price\\":\s*([0-9]{3,8})/i) ||
                          html.match(/"price"\s*:\s*([0-9]{3,8})/i);
    if (rscPriceMatch && rscPriceMatch[1]) {
        const p = parseInt(rscPriceMatch[1]);
        if (p >= 100 && p < 5000000) return `￥${p.toLocaleString()}`;
    }

    // 2. Amazon price
    const amazonPriceWhole = html.match(/<span class="a-price-whole">([0-9,]+)/i);
    if (amazonPriceWhole && amazonPriceWhole[1]) {
        const cleanP = parseInt(amazonPriceWhole[1].replace(/[,.]/g, ''));
        if (cleanP) return `￥${cleanP.toLocaleString()}`;
    }

    // 3. General price regexes
    const priceRegexes = [
        /"priceAmount"\s*:\s*"?([0-9,]+)"?/,
        /["']price["']\s*:\s*["']?([0-9,]{3,8})["']?/,
        /￥\s*([0-9,]{3,9})/
    ];

    for (const reg of priceRegexes) {
        const m = html.match(reg);
        if (m && m[1]) {
            const num = parseInt(m[1].replace(/,/g, ''));
            if (!isNaN(num) && num >= 100 && num < 10000000) {
                return `￥${num.toLocaleString()}`;
            }
        }
    }

    return '';
}

async function testAll(url) {
    console.log('\n--- Testing Price Extraction for:', url, '---');
    let price = '';
    try {
        const html = await fetchUrlHtml(url);
        price = extractPriceFromHtml(html);
    } catch (e) {}

    if (!price) {
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
                const el = document.querySelector('[data-testid="price"], .merItemPrice, [class*="price"], .a-price .a-offscreen');
                if (el && el.textContent) {
                    const m = el.textContent.match(/¥\s*([0-9,]+)|￥\s*([0-9,]+)|([0-9,]+)\s*円/);
                    if (m) return `￥${parseInt((m[1]||m[2]||m[3]).replace(/,/g, '')).toLocaleString()}`;
                }
                return '';
            });
        } catch (err) {
        } finally {
            if (browser) await browser.close();
        }
    }

    console.log('RESULT price:', price);
}

(async () => {
    await testAll('https://jp.mercari.com/item/m73194523883');
    await testAll('https://www.amazon.co.jp/dp/B001RLZ94S/');
})();
