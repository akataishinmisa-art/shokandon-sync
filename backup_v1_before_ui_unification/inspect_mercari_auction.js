const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://jp.mercari.com/item/m41184150225', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

    const result = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a')).map(b => ({
            text: b.textContent.trim(),
            disabled: b.disabled || false,
            testId: b.getAttribute('data-testid') || ''
        })).filter(b => b.text.includes('入札') || b.text.includes('購入') || b.text.includes('売り切れ') || b.text.includes('終了'));

        const soldBadges = Array.from(document.querySelectorAll('[data-testid*="sold"], [aria-label*="売り切れ"], [class*="sold"], [class*="Sold"]')).map(el => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            aria: el.getAttribute('aria-label') || ''
        }));

        const isAuction = document.body.innerText.includes('オークション商品') || document.body.innerText.includes('入札する');

        return { buttons, soldBadges, isAuction };
    });

    console.log('Auction test result:', JSON.stringify(result, null, 2));
    await browser.close();
})();
