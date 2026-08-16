const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    const executablePath = '/usr/bin/chromium-browser' || '/usr/bin/google-chrome';
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (fs.existsSync('/usr/bin/google-chrome')) {
        launchOptions.executablePath = '/usr/bin/google-chrome';
    } else if (fs.existsSync('/usr/bin/chromium')) {
        launchOptions.executablePath = '/usr/bin/chromium';
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const url = 'https://jp.mercari.com/item/m68792414248';
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

    const analysis = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent.trim(),
            disabled: b.disabled,
            ariaDisabled: b.getAttribute('aria-disabled'),
            testid: b.getAttribute('data-testid'),
            outerHTML: b.outerHTML
        }));

        const soldBadges = Array.from(document.querySelectorAll('[data-testid*="sold"], [aria-label*="売り切れ"], [class*="sold"]')).map(el => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            ariaLabel: el.getAttribute('aria-label'),
            testid: el.getAttribute('data-testid'),
            class: el.className
        }));

        const bodyTextContainsSold = document.body.innerText.includes('売り切れました');
        const allText = document.body.innerText.slice(0, 500);

        return {
            title: document.title,
            buttons,
            soldBadges,
            bodyTextContainsSold,
            allText
        };
    });

    console.log('--- ANALYSIS RESULT ---');
    console.log(JSON.stringify(analysis, null, 2));

    await browser.close();
})();
