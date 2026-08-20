const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://jp.mercari.com/item/m62808756184';
    console.log('Testing Puppeteer in-page fetch for Mercari image:', url);

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const itemMatch = url.match(/item\/(m\d+)/);
    const mId = itemMatch[1];
    const testImgUrl = `https://static.mercdn.net/item/detail/orig/photos/${mId}_1.jpg`;

    const dataUrl = await page.evaluate(async (imgSrc) => {
        try {
            const resp = await fetch(imgSrc);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    }, testImgUrl);

    if (dataUrl && dataUrl.startsWith('data:image')) {
        const base64Data = dataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const savePath = path.join(__dirname, 'mercari_test_1.jpg');
        fs.writeFileSync(savePath, buffer);
        console.log(`🎉 SUCCESS! Downloaded ${buffer.length} bytes to ${savePath}`);
    } else {
        console.log('❌ Failed in-page fetch');
    }

    await browser.close();
})();
