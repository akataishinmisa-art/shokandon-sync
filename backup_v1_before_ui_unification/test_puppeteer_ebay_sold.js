const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

async function fetchEbaySoldWithPuppeteer(searchQuery) {
    if (!searchQuery || !searchQuery.trim()) return null;

    let cleanKw = searchQuery
        .replace(/【[^】]+】|\[[^\]]+\]/g, ' ')
        .replace(/【|】|中古|美品|極美品|ジャンク|動作確認済|箱付|セット|本体のみ|送料無料|爆買/gi, '')
        .trim();

    const enMatches = cleanKw.match(/[A-Za-z0-9\-_.]+/g);
    if (enMatches && enMatches.length > 0) {
        cleanKw = enMatches.join(' ');
    }

    if (!cleanKw || cleanKw.length < 2) return null;

    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const targetUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanKw)}&LH_Sold=1&LH_Complete=1`;
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const prices = await page.evaluate(() => {
            const list = [];
            const els = document.querySelectorAll('.s-item__price');
            els.forEach(el => {
                const text = el.innerText || '';
                const m = text.match(/\$\s*([0-9,.]+)/);
                if (m) {
                    const p = parseFloat(m[1].replace(/,/g, ''));
                    if (!isNaN(p) && p > 5 && p < 10000) {
                        list.push(p);
                    }
                }
            });
            return list;
        });

        if (prices.length > 0) {
            prices.sort((a, b) => a - b);
            const sPrice = Math.round(prices[Math.floor(prices.length * 0.85)] || prices[prices.length - 1]);
            const aPrice = Math.round(prices[Math.floor(prices.length * 0.50)] || prices[Math.floor(prices.length / 2)]);
            const bPrice = Math.round(prices[Math.floor(prices.length * 0.20)] || prices[0]);

            return {
                s: `$${sPrice}`,
                a: `$${aPrice}`,
                b: `$${bPrice}`,
                count: prices.length,
                query: cleanKw
            };
        }
    } catch (e) {
        console.warn('[Puppeteer eBay Search Warning]:', e.message);
    } finally {
        if (browser) await browser.close();
    }
    return null;
}

(async () => {
    console.log('Puppeteer eBay P900:', await fetchEbaySoldWithPuppeteer('Nikon COOLPIX P900'));
    console.log('Puppeteer eBay PCH-2000:', await fetchEbaySoldWithPuppeteer('Sony PS Vita PCH-2000'));
})();
