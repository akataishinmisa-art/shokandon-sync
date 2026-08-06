const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const imgUrl = 'https://static.mercdn.net/item/detail/orig/photos/m62808756184_1.jpg';
    console.log('Testing Puppeteer page.goto for image:', imgUrl);

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const response = await page.goto(imgUrl, { waitUntil: 'networkidle2' });
    console.log('HTTP Status:', response.status());

    if (response.status() === 200) {
        const buffer = await response.buffer();
        const savePath = path.join(__dirname, 'mercari_direct_1.jpg');
        fs.writeFileSync(savePath, buffer);
        console.log(`🎉 SUCCESS! Saved ${buffer.length} bytes to ${savePath}`);
    } else {
        console.log('❌ HTTP status not 200:', response.status());
    }

    await browser.close();
})();
