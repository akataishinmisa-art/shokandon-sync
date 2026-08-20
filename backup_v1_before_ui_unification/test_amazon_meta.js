const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

function fetchUrlHtml(targetUrl) {
    return new Promise((resolve, reject) => {
        const client = targetUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        };
        const req = client.get(targetUrl, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const parsed = new URL(targetUrl);
                    redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
                }
                return fetchUrlHtml(redirectUrl).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(8000, () => {
            req.destroy();
            reject(new Error('URL timeout'));
        });
    });
}

async function testParse(url) {
    console.log('\n--- Testing Amazon Meta Parsing for:', url, '---');
    let imageUrl = '';
    let title = '';

    try {
        const rawHtml = await fetchUrlHtml(url);
        
        // Amazon Image Extraction
        const colorMatch = rawHtml.match(/'colorImages':\s*\{\s*'INITIAL':\s*(\[[\s\S]*?\])\s*\}/) ||
                           rawHtml.match(/"colorImages":\s*\{\s*"INITIAL":\s*(\[[\s\S]*?\])\s*\}/);
        if (colorMatch) {
            try {
                const parsed = JSON.parse(colorMatch[1]);
                if (parsed && parsed.length > 0) {
                    imageUrl = parsed[0].hiRes || parsed[0].large || parsed[0].thumb || '';
                }
            } catch (e) {}
        }

        if (!imageUrl) {
            const dynMatch = rawHtml.match(/data-a-dynamic-image=["'](\{[\s\S]*?\})["']/i);
            if (dynMatch) {
                try {
                    const jsonStr = dynMatch[1].replace(/&quot;/g, '"');
                    const parsed = JSON.parse(jsonStr);
                    const keys = Object.keys(parsed);
                    if (keys.length > 0) imageUrl = keys[0];
                } catch (e) {}
            }
        }

        if (!imageUrl) {
            const amazonMediaMatch = rawHtml.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9_\-\.]+\.(?:jpg|jpeg|png|webp)/i);
            if (amazonMediaMatch) {
                imageUrl = amazonMediaMatch[0];
            }
        }

        if (imageUrl) {
            imageUrl = imageUrl.replace(/\._AC_[^.]*(\.[a-zA-Z]+)$/, '$1')
                               .replace(/\._SS[^.]*(\.[a-zA-Z]+)$/, '$1')
                               .replace(/\._SX[^.]*(\.[a-zA-Z]+)$/, '$1')
                               .replace(/\._SY[^.]*(\.[a-zA-Z]+)$/, '$1');
        }

        console.log('HTTP GET extracted image:', imageUrl);
    } catch (e) {
        console.error('HTTP GET Error:', e.message);
    }

    // If HTTP GET failed to get image, launch Puppeteer fallback
    if (!imageUrl) {
        console.log('Launching Puppeteer fallback for Amazon image...');
        let browser = null;
        try {
            browser = await puppeteer.launch({
                executablePath,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

            imageUrl = await page.evaluate(() => {
                const img = document.querySelector('#landingImage, #imgBlkFront, #main-image-container img');
                return img ? (img.getAttribute('data-old-hires') || img.src || '') : '';
            });

            if (imageUrl) {
                imageUrl = imageUrl.replace(/\._AC_[^.]*(\.[a-zA-Z]+)$/, '$1');
            }
            console.log('Puppeteer extracted image:', imageUrl);
        } catch (err) {
            console.error('Puppeteer Error:', err.message);
        } finally {
            if (browser) await browser.close();
        }
    }

    console.log('FINAL RESULT imageUrl:', imageUrl);
}

(async () => {
    await testParse('https://www.amazon.co.jp/dp/B001RLZ94S/');
    await testParse('https://www.amazon.co.jp/dp/B0DXW412HY/');
})();
