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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.goto('https://jp.mercari.com/item/m41184150225', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

    const result = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const allButtons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
        const h1 = document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : '';
        return { h1, allButtons, bodySnippet: bodyText.substring(0, 500) };
    });

    console.log('Detailed Mercari Result:', JSON.stringify(result, null, 2));
    await browser.close();
})();
