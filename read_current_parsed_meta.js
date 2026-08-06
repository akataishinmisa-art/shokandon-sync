const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 960 });

        console.log('Checking eBay Listing Helper http://localhost:8085...');
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2', timeout: 15000 });

        const info = await page.evaluate(() => {
            const urlInput = document.getElementById('input-url')?.value || '';
            const mpnInput = document.getElementById('input-mpn')?.value || '';
            const priceInput = document.getElementById('input-price')?.value || '';
            const descDetails = document.getElementById('input-desc-details')?.value || '';
            const imgThumb = document.getElementById('img-header-thumb')?.src || '';

            return { urlInput, mpnInput, priceInput, descDetails, imgThumb };
        });

        console.log('Current UI Info:', JSON.stringify(info, null, 2));

        if (info.urlInput) {
            console.log('\nParsing Meta for URL:', info.urlInput);
            const resp = await fetch('http://localhost:3000/api/parse-url-meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: info.urlInput })
            });
            const meta = await resp.json();
            console.log('Parsed Meta Result:', JSON.stringify(meta, null, 2));
        }

        await browser.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
