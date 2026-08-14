const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
let puppeteer = null;
try {
    puppeteer = require('puppeteer-core');
} catch (e) {}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const linuxChromePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const executablePath = fs.existsSync(linuxChromePath) ? linuxChromePath : (fs.existsSync(chromePath) ? chromePath : edgePath);

function getPrimarySaveDir() {
    const candidates = [
        'C:\\Users\\akata\\OneDrive\\デスクトップ\\商管どん_商品画像',
        'C:\\Users\\akata\\Desktop\\商管どん_商品画像',
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
    return `${yyyy}-${mm}-${dd}_${hh}${min}`;
}

function sanitizeFolderName(name) {
    if (!name) return '商品画像';
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
            reject(new Error('URL読み込みタイムアウト'));
        });
    });
}

// Full-fledged image extraction engine using Puppeteer & HTML Regex
async function extractAllImageUrls(targetUrl, externalPage = null) {
    const images = [];

    // --- Special Fast & Isolated Handler for Yahoo Fleamarket / PayPay Fleamarket ---
    if (targetUrl.includes('paypayfleamarket.yahoo.co.jp') || targetUrl.includes('frima.yahoo.co.jp') || targetUrl.includes('paypay')) {
        try {
            let html = '';
            if (externalPage) {
                html = await externalPage.content();
            } else {
                html = await fetchUrlHtml(targetUrl);
            }

            const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
            if (nextDataMatch) {
                try {
                    const nextData = JSON.parse(nextDataMatch[1]);
                    const pageProps = nextData?.props?.pageProps;
                    const item = pageProps?.item || pageProps?.initialState?.item || pageProps?.itemDetail || pageProps?.productDetail;
                    if (item) {
                        const itemImgs = item.images || item.imageUrls || item.itemImages || [];
                        const itemOnlyUrls = [];
                        for (const imgObj of itemImgs) {
                            let u = typeof imgObj === 'string' ? imgObj : (imgObj?.url || imgObj?.src || imgObj?.originalUrl);
                            if (u && typeof u === 'string' && u.startsWith('http')) {
                                itemOnlyUrls.push(u);
                            }
                        }
                        if (itemOnlyUrls.length > 0) {
                            console.log(`[Yahoo Fleamarket Image Extractor]: __NEXT_DATA__ から出品商品の全画像 ${itemOnlyUrls.length}枚 のみを限定抽出（関連商品を除外）`);
                            return Array.from(new Set(itemOnlyUrls));
                        }
                    }
                } catch (e) {
                    console.warn('[Yahoo Fleamarket __NEXT_DATA__ Parse Exception]:', e.message);
                }
            }

            // Regex extraction for all Yahoo item images (auctions.c.yimg.jp or item-shopping) from static HTML
            const yimgRegexMatches = html.match(/https:\/\/(?:auctions\.c\.yimg\.jp|item-shopping\.c\.yimg\.jp)\/images\.auctions\.yahoo\.co\.jp\/image\/[^\s"'<>]+/gi) ||
                                     html.match(/https:\/\/auc-pctr\.c\.yimg\.jp\/i\/auctions\.c\.yimg\.jp\/images\.auctions\.yahoo\.co\.jp\/image\/[^\s"'<>]+/gi);
            if (yimgRegexMatches && yimgRegexMatches.length > 0) {
                const itemImgSet = new Set();
                for (let matchUrl of yimgRegexMatches) {
                    // Extract high-resolution original image URL from yimg CDN url
                    let cleanUrl = matchUrl.split('?')[0];
                    if (cleanUrl.includes('auc-pctr.c.yimg.jp/i/')) {
                        const subMatch = cleanUrl.match(/https:\/\/(?:images|auctions)[^\s"'<>]+/);
                        if (subMatch) cleanUrl = subMatch[0];
                    }
                    if (cleanUrl && !cleanUrl.includes('na_170x170') && !cleanUrl.includes('ogp_1200_630')) {
                        itemImgSet.add(cleanUrl);
                    }
                }

                // Strictly filter by seller user ID (users/...) if present
                const ownerMatch = html.match(/users\/([a-f0-9]{32,64})/i) || html.match(/users\/([a-zA-Z0-9_\-]+)\//i);
                if (ownerMatch && ownerMatch[0]) {
                    const ownerPath = ownerMatch[0];
                    const ownerImgs = Array.from(itemImgSet).filter(url => url.includes(ownerPath));
                    if (ownerImgs.length > 0) {
                        console.log(`[Yahoo Fleamarket Image Extractor]: 出品者ID (${ownerPath}) の全画像 ${ownerImgs.length}枚 を完全限定抽出！`);
                        return ownerImgs;
                    }
                }

                if (itemImgSet.size > 0) {
                    console.log(`[Yahoo Fleamarket Image Extractor]: HTML正規表現から出品商品の全画像 ${itemImgSet.size}枚 を限定抽出`);
                    return Array.from(itemImgSet);
                }
            }
        } catch (e) {
            console.warn('[Yahoo Fleamarket Fast Extraction Warning]:', e.message);
        }
    }

    let page = externalPage;
    let browserToClose = null;

    if (!page && puppeteer) {
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

    if (page) {
        try {
            const html = await page.content();

            if (targetUrl.includes('paypayfleamarket.yahoo.co.jp') || targetUrl.includes('frima.yahoo.co.jp')) {
                // Yahoo Fleamarket DOM Fallback strictly isolated from recommendations
                const domImages = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('main img, [class*="ItemImage"] img, [class*="ItemSlider"] img, [class*="ImageGallery"] img, [data-testid="item-image"] img, [class*="Thumbnail"] img'));
                    return imgs.filter(img => {
                        const parent = img.closest('section, div, article');
                        if (parent) {
                            const className = parent.className || '';
                            const text = parent.innerText || '';
                            if (className.toLowerCase().includes('recommend') || text.includes('オススメ') || text.includes('おすすめ')) {
                                return false;
                            }
                        }
                        return true;
                    }).map(img => img.src).filter(Boolean);
                });
                images.push(...domImages);
            } else if (targetUrl.includes('amazon.co.jp') || targetUrl.includes('amazon.com')) {
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
        if (imgUrl.includes('.svg') || imgUrl.includes('play-button') || imgUrl.includes('icon') || imgUrl.includes('logo') || imgUrl.includes('sprite')) continue;
        if (imgUrl.includes('auc-pctr.c.yimg.jp') || imgUrl.includes('nf_src=sy') || imgUrl.includes('na_170x170') || imgUrl.includes('ogp_1200_630')) continue;

        // Clean Amazon thumbnail parameters
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
        const safeTitle = sanitizeFolderName(title || '商品画像');
        const folderName = `${timeStr}_${safeTitle}`;
        const itemSaveDir = path.join(activeSaveDir, folderName);

        ensureDir(itemSaveDir);

        console.log(`🔍 商品ページ (${url}) の全画像をスキャン中...`);
        let imageUrls = await extractAllImageUrls(url, page);

        if (fallbackImageUrl && fallbackImageUrl.startsWith('http') && !imageUrls.includes(fallbackImageUrl)) {
            imageUrls.unshift(fallbackImageUrl);
        }

        if (imageUrls.length === 0) {
            console.log(`📷 行${rowNum}: 画像URLが見つかりませんでした。`);
            return 0;
        }

        console.log(`📷 行${rowNum}: 全 ${imageUrls.length}枚 の画像をダウンロード中... (${folderName})`);

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
                console.warn(`  - 画像${i + 1} のダウンロードスキップ: ${err.message}`);
            }
        }

        console.log(`✅ 行${rowNum}: 画像${successCount}/${imageUrls.length} 枚を正常保存完了 (${itemSaveDir})`);
        return successCount;
    } catch (e) {
        console.error(`❌ 行${rowNum} 画像ダウンロード例外:`, e.message);
        return 0;
    }
}

module.exports = {
    processAndDownloadImages,
    extractImageUrlsFromPage: extractAllImageUrls,
    BASE_SAVE_DIR: getPrimarySaveDir()
};
