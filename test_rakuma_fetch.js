const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const http = require('http');

function getExecutablePath() {
    if (process.platform === 'linux') return '/usr/bin/chromium';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}

function fetchHtmlDirect(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchHtmlDirect(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, html: data }));
        }).on('error', reject);
    });
}

async function testRakuma() {
    const url = 'https://item.fril.jp/22d4c7937f576d2d652ad56a192d6d2e';
    console.log('--- Testing Direct HTTP GET ---');
    try {
        const res = await fetchHtmlDirect(url);
        console.log('HTTP Status:', res.statusCode);
        console.log('HTML Length:', res.html.length);
        const titleMatch = res.html.match(/<title>(.*?)<\/title>/i);
        console.log('Title:', titleMatch ? titleMatch[1] : 'NONE');
    } catch (e) {
        console.error('HTTP GET Error:', e.message);
    }

    console.log('\n--- Testing Puppeteer Navigation ---');
    const browser = await puppeteer.launch({
        executablePath: getExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log('Navigating via Puppeteer (waitUntil: domcontentloaded)...');
        const start = Date.now();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`Page loaded in ${Date.now() - start} ms`);
        
        const title = await page.title();
        console.log('Puppeteer Page Title:', title);
    } catch (e) {
        console.error('Puppeteer Error:', e.message);
    }

    await browser.close();
}

testRakuma();
