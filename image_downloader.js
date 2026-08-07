const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const linuxChromePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium' || '/usr/bin/google-chrome';
const executablePath = fs.existsSync(linuxChromePath) ? linuxChromePath : (fs.existsSync(chromePath) ? chromePath : edgePath);

function getPrimarySaveDir() {
    const candidates = [
        'C:\\Users\\akata\\OneDrive\\繝・せ繧ｯ繝医ャ繝予\蝠・ｮ｡縺ｩ繧点蝠・刀逕ｻ蜒・,
        'C:\\Users\\akata\\Desktop\\蝠・ｮ｡縺ｩ繧点蝠・刀逕ｻ蜒・,
        path.join(__dirname, 'downloaded_images')
    ];

    for (const dir of candidates) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const testFile = path.join(dir, `.perm_test_${Date.now()}`);
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            return dir;
        } catch (e) {
            console.warn(`[SaveDir Warning] Directory unavailable (${dir}): ${e.message}`);
        }
    }
    return candidates[2];
}

function ensureDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (e) {
        console.error(`ensureDir failed for ${dirPath}:`, e.message);
    }
}

function getFormattedTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    // Windows safe timestamp format: YYYY-MM-DD_HH譎・M蛻・    return `${yyyy}-${mm}-${dd}_${hh}譎・{min}蛻・;
}

function sanitizeFolderName(name) {
    if (!name) return '蝠・刀逕ｻ蜒・;
    return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 35).trim();
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        if (!url || !url.startsWith('http')) return reject(new Error('Invalid URL'));

        const client = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': url.includes('amazon') ? 'https://www.amazon.co.jp/' : 'https://jp.mercari.com/'
            }
        };

        const req = client.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(true);
            });
            fileStream.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Download timeout'));
        });
    });
}

// Full-fledged image extraction engine using Puppeteer & HTML Regex
async function extractAllImageUrls(targetUrl, externalPage = null) {
    let page = externalPage;
    let browserToClose = null;

    if (!page) {
        try {
            const browser = await puppeteer.launch({
                executablePath: executablePath,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
            });
            browserToClose = browser;
            page = await browser.newPage();
            await page.setViewport({ width: 1400, height: 900 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
            await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
        } catch (err) {
            console.error('[extractAllImageUrls Launch Error]:', err.message);
        }
    }

    const images = [];

    if (page) {
        try {
            const html = await page.content();

            if (targetUrl.includes('amazon.co.jp') || targetUrl.includes('amazon.com')) {
                // 1. Amazon inline script colorImages
                const colorImagesMatch = html.match(/'colorImages':\s*\{\s*'INITIAL':\s*(\[[\s\S]*?\])\s*\}/) ||
                                         html.match(/"colorImages":\s*\{\s*"INITIAL":\s*(\[[\s\S]*?\])\s*\}/);

                if (colorImagesMatch) {
                    try {
                        const parsed = JSON.parse(colorImagesMatch[1]);
                        for (const item of parsed) {
                            const hiRes = item.hiRes || item.large || item.thumb;
                            if (hiRes) images.push(hiRes);
                        }
                    } catch (e) {}
                }

                // 2. Amazon DOM altImages
                const domImages = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('#altImages ul li img, #landingImage, #imgBlkFront, #main-image-container img'));
                    return imgs.map(i => i.getAttribute('data-old-hires') || i.src || '').filter(Boolean);
                });

                for (const dUrl of domImages) {
                    images.push(dUrl);
                }
            } else if (targetUrl.includes('mercari.com')) {
                // Mercari
                const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
                if (nextDataMatch) {
                    try {
                        const json = JSON.parse(nextDataMatch[1]);
                        const photos = json?.props?.pageProps?.item?.photos || [];
                        for (const p of photos) {
                            if (typeof p === 'string') images.push(p);
                            else if (p.url) images.push(p.url);
                        }
                    } catch (e) {}
                }

                const domImages = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('[data-testid="carousel-item"] img, .slick-slide img, img[src*="mercdn"]'));
                    return imgs.map(img => img.src).filter(Boolean);
                });
                images.push(...domImages);
            } else if (targetUrl.includes('auctions.yahoo.co.jp')) {
                const domImages = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('.ProductImage__slider img, ul.ProductImage__images img, .ProductImage__footerThumbnail img'));
                    return imgs.map(img => img.getAttribute('data-src') || img.src || '').filter(Boolean);
                });
                for (const imgUrl of domImages) {
                    const highRes = imgUrl.replace(/_[t|s|thumb]\.jpg$/, '.jpg').replace(/_[t|s|thumb]\.jpeg$/, '.jpeg');
                    images.push(highRes);
                }
            } else {
                // General EC Sites
                const domImages = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('main img, #content img, article img, .product-image img, .gallery img'));
                    return imgs.map(img => img.src).filter(src => src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon'));
                });
                images.push(...domImages);
            }
        } catch (err) {
            console.error('[Page Evaluate Error]:', err.message);
        }
    }

    if (browserToClose) {
        try {
            await browserToClose.close();
        } catch (e) {}
    }

    // Clean & Upscale Amazon/Mercari Image URLs to Original HD
    const cleanedUrls = [];
    const seen = new Set();

    for (let imgUrl of images) {
        if (!imgUrl || !imgUrl.startsWith('http')) continue;
        if (imgUrl.includes('play-button') || imgUrl.includes('icon') || imgUrl.includes('logo') || imgUrl.includes('sprite')) continue;

        // Clean Amazon thumbnail parameters (e.g. ._AC_US40_.jpg -> .jpg)
        if (imgUrl.includes('amazon.com') || imgUrl.includes('media-amazon.com')) {
            imgUrl = imgUrl.replace(/\._AC_[^.]*(\.[a-zA-Z]+)$/, '$1')
                           .replace(/\._SS[^.]*(\.[a-zA-Z]+)$/, '$1')
                           .replace(/\._SX[^.]*(\.[a-zA-Z]+)$/, '$1')
                           .replace(/\._SY[^.]*(\.[a-zA-Z]+)$/, '$1');
        }

        // Clean Mercari thumbnail
        if (imgUrl.includes('mercdn.net')) {
            imgUrl = imgUrl.replace('/thumb/', '/orig/');
        }

        if (!seen.has(imgUrl)) {
            seen.add(imgUrl);
            cleanedUrls.push(imgUrl);
        }
    }

    return cleanedUrls;
}

async function processAndDownloadImages(page, url, rowNum, title, html = '', fallbackImageUrl = '') {
    try {
        const activeSaveDir = getPrimarySaveDir();
        ensureDir(activeSaveDir);

        const timeStr = getFormattedTimestamp();
        const safeTitle = sanitizeFolderName(title || '蝠・刀逕ｻ蜒・);
        const folderName = `${timeStr}_${safeTitle}`;
        const itemSaveDir = path.join(activeSaveDir, folderName);

        ensureDir(itemSaveDir);

        console.log(`剥 蝠・刀繝壹・繧ｸ (${url}) 縺ｮ蜈ｨ逕ｻ蜒上ｒ繧ｹ繧ｭ繝｣繝ｳ荳ｭ...`);
        let imageUrls = await extractAllImageUrls(url, page);

        if (fallbackImageUrl && fallbackImageUrl.startsWith('http') && !imageUrls.includes(fallbackImageUrl)) {
            imageUrls.unshift(fallbackImageUrl);
        }

        if (imageUrls.length === 0) {
            console.log(`胴 陦・${rowNum}: 逕ｻ蜒酋RL縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆縲Ａ);
            return 0;
        }

        console.log(`胴 陦・${rowNum}: 蜈ｨ ${imageUrls.length}譫・縺ｮ逕ｻ蜒上ｒ繝繧ｦ繝ｳ繝ｭ繝ｼ繝我ｸｭ... (${folderName})`);

        let successCount = 0;
        for (let i = 0; i < imageUrls.length; i++) {
            const imgUrl = imageUrls[i];
            const extMatch = imgUrl.match(/\.(jpg|jpeg|png|webp|avif)/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
            const fileName = `${String(successCount + 1).padStart(2, '0')}.${ext}`;
            const filePath = path.join(itemSaveDir, fileName);

            try {
                await downloadFile(imgUrl, filePath);
                successCount++;
            } catch (err) {
                console.warn(`  - 逕ｻ蜒・${i + 1} 縺ｮ繝繧ｦ繝ｳ繝ｭ繝ｼ繝峨せ繧ｭ繝・・: ${err.message}`);
            }
        }

        console.log(`笨・陦・${rowNum}: 逕ｻ蜒・${successCount}/${imageUrls.length} 譫壹ｒ豁｣蟶ｸ菫晏ｭ伜ｮ御ｺ・ｼ・(${itemSaveDir})`);
        return successCount;
    } catch (e) {
        console.error(`笶・陦・${rowNum} 逕ｻ蜒上ム繧ｦ繝ｳ繝ｭ繝ｼ繝我ｾ句､・`, e.message);
        return 0;
    }
}

module.exports = {
    processAndDownloadImages,
    extractImageUrlsFromPage: extractAllImageUrls,
    BASE_SAVE_DIR: getPrimarySaveDir()
};
