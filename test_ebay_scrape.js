const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function searchEbaySoldPrices(keyword) {
    let browser;
    try {
        console.log(`Starting Puppeteer to search eBay for: ${keyword}`);
        browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Sold=1&LH_Complete=1&LH_ItemCondition=3000&_sop=12`;
        console.log(`Navigating to: ${url}`);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for results
        await page.waitForSelector('.s-item__price', { timeout: 10000 }).catch(() => console.log('Timeout waiting for prices'));
        
        const prices = await page.evaluate(() => {
            const priceElements = document.querySelectorAll('.s-item__price');
            const results = [];
            priceElements.forEach(el => {
                const text = el.innerText;
                const match = text.match(/\$([0-9,.]+)/);
                if (match) {
                    const priceStr = match[1].replace(/,/g, '');
                    const price = parseFloat(priceStr);
                    if (!isNaN(price) && price > 0 && price < 100000) {
                        results.push(price);
                    }
                }
            });
            return results;
        });
        
        console.log(`Found ${prices.length} prices:`, prices.slice(0, 5));
        
    } catch (err) {
        console.error('Error during scraping:', err);
    } finally {
        if (browser) await browser.close();
    }
}

searchEbaySoldPrices('Nikon COOLPIX P500');
