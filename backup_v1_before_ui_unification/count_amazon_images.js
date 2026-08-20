const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    const url = 'https://www.amazon.co.jp/dp/B0DXW412HY/';
    console.log('Counting images for Amazon item:', url);

    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const html = await page.content();

    // 1. Extract colorImages JSON
    const images = [];
    const colorImagesMatch = html.match(/'colorImages':\s*\{\s*'INITIAL':\s*(\[[\s\S]*?\])\s*\}/) ||
                             html.match(/"colorImages":\s*\{\s*"INITIAL":\s*(\[[\s\S]*?\])\s*\}/);

    if (colorImagesMatch) {
        try {
            const parsed = JSON.parse(colorImagesMatch[1]);
            for (const item of parsed) {
                const imgUrl = item.hiRes || item.large || item.thumb;
                if (imgUrl) images.push(imgUrl);
            }
        } catch (e) {
            console.error('JSON parse error:', e.message);
        }
    }

    // 2. Extract altImages DOM
    const domImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('#altImages ul li img, #landingImage, #imgBlkFront'));
        return imgs.map(img => img.getAttribute('data-old-hires') || img.src || '').filter(Boolean);
    });

    for (const dUrl of domImages) {
        const clean = dUrl.replace(/\._AC_[^.]*(\.[a-zA-Z]+)$/, '$1');
        if (!images.includes(clean) && !clean.includes('play-button') && !clean.includes('icon')) {
            images.push(clean);
        }
    }

    const uniqueImages = [...new Set(images)];

    console.log(`TOTAL UNIQUE PRODUCT IMAGES: ${uniqueImages.length}`);
    uniqueImages.forEach((img, i) => {
        console.log(`Image ${i+1}: ${img}`);
    });

    await browser.close();
})();
