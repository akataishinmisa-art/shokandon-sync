const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const url = 'https://auctions.yahoo.co.jp/jp/auction/j1228620924';
    console.log('Testing URL:', url);

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('HTTP Status:', resp.status());

        await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));

        const title = await page.title();
        const bodyText = await page.evaluate(() => document.body.innerText);
        const h1Text = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            return h1 ? h1.innerText.trim() : '';
        });

        console.log('Page Title:', title);
        console.log('H1 Text:', h1Text);
        console.log('Body Text Snippet (first 400 chars):', bodyText.substring(0, 400));

        // 状態・ボタンなどのチェック
        const isEnded = bodyText.includes('このオークションは終了しました') || bodyText.includes('指定されたオークションは存在しません') || bodyText.includes('オークションは終了');
        console.log('Is Ended/Closed detected:', isEnded);

    } catch (e) {
        console.error('Error visiting URL:', e.message);
    }

    await browser.close();
})();
