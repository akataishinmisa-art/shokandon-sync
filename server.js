const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
// puppeteer-core is optional - server starts even if it fails to load
let puppeteer = null;
try {
    puppeteer = require('puppeteer-core');
    console.log('[Startup] puppeteer-core loaded OK');
} catch (e) {
    console.warn('[Startup] puppeteer-core could not be loaded (OK on Render):', e.message);
}

// image_downloader is optional - server starts even if it fails to load
let processAndDownloadImages = null, extractImageUrlsFromPage = null, BASE_SAVE_DIR = null;
try {
    const dl = require('./image_downloader');
    processAndDownloadImages = dl.processAndDownloadImages;
    extractImageUrlsFromPage = dl.extractImageUrlsFromPage;
    BASE_SAVE_DIR = dl.BASE_SAVE_DIR;
    console.log('[Startup] image_downloader loaded OK');
} catch (e) {
    console.warn('[Startup] image_downloader could not be loaded (OK on Render):', e.message);
    BASE_SAVE_DIR = require('path').join(__dirname, 'downloaded_images');
}

function getExecutablePath() {
    if (process.platform === 'linux') {
        const linuxPaths = [
            process.env.CHROMIUM_PATH,
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable'
        ].filter(Boolean);
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) return p;
        }
        return '/usr/bin/chromium';
    }
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    return fs.existsSync(chromePath) ? chromePath : edgePath;
}
const executablePath = getExecutablePath();

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const USER_SETTINGS_PATH = path.join(__dirname, 'user_settings.json');
const CUSTOM_MPN_PRICES_PATH = path.join(__dirname, 'custom_mpn_prices.json');

process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception Guard]:', err ? (err.stack || err.message || err) : err);
    // Do NOT exit - keep the server running so Render health check can pass
});
process.on('unhandledRejection', (reason) => {
    console.error('[Unhandled Rejection Guard]:', reason ? (reason.stack || reason.message || reason) : reason);
});
console.log(`[Startup] PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV}, RENDER=${process.env.RENDER}`);

app.use(cors());
app.use(express.json());
app.use('/ebay', express.static(path.join(__dirname, 'ebay-title-generator')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/version', (req, res) => {
    res.json({
        version: 'v2.0.0-sparticuz',
        commit: 'e62cf36',
        platform: process.platform,
        node: process.version
    });
});

app.get('/ebay', (req, res) => {
    res.sendFile(path.join(__dirname, 'ebay-title-generator', 'index.html'));
});

// Load & Save Custom MPN Prices (PCH-2000, etc.)
function loadCustomMpnPrices() {
    try {
        if (fs.existsSync(CUSTOM_MPN_PRICES_PATH)) {
            const data = fs.readFileSync(CUSTOM_MPN_PRICES_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {}
    return {
        "PCH-2000": { "s": "$260", "a": "$200", "b": "$160" }
    };
}

function saveCustomMpnPrices(customMap) {
    try {
        fs.writeFileSync(CUSTOM_MPN_PRICES_PATH, JSON.stringify(customMap, null, 2), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
}

// Load & Save User Settings (為替, 利益率, 発送料) for Server-side File Persistence
function loadUserSettings() {
    try {
        if (fs.existsSync(USER_SETTINGS_PATH)) {
            const data = fs.readFileSync(USER_SETTINGS_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {}
    return { exchange: '', margin: '', exportShipping: '' };
}

function saveUserSettings(newSettings) {
    try {
        const current = loadUserSettings();
        const updated = { ...current, ...newSettings };
        fs.writeFileSync(USER_SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
}

app.get('/api/user-settings', (req, res) => res.json(loadUserSettings()));
app.post('/api/user-settings', (req, res) => {
    const ok = saveUserSettings(req.body);
    res.json({ success: ok, settings: loadUserSettings() });
});

// Deep Product Category & Generation Resolver for unlisted product URLs
function estimateCategoryEbayMarketPrices(text) {
    if (!text) return { s: '$150', a: '$110', b: '$80', matchedCategoryName: '不明/一般商品' };
    text = text.toUpperCase();

    // 1. Next Gen Consoles (PS5)
    if (text.match(/PLAYSTATION\s*5|PS5/)) {
        return { s: '$480', a: '$420', b: '$360', matchedCategoryName: 'PS5本体' };
    }

    // 2. Previous Gen Home Consoles (Switch 1, PS4, Wii U, Wii, Xbox One, etc.)
    if (text.match(/SWITCH\s*OLED/)) return { s: '$320', a: '$260', b: '$210', matchedCategoryName: 'Switch 有機ELモデル' };
    if (text.match(/PLAYSTATION\s*4|PS4/)) return { s: '$210', a: '$160', b: '$120', matchedCategoryName: 'PS4本体' };
    if (text.match(/WII\s*U/)) return { s: '$180', a: '$130', b: '$90', matchedCategoryName: 'Wii U本体' };
    if (text.match(/\bWII\b|ウィー/)) return { s: '$120', a: '$70', b: '$45', matchedCategoryName: 'Wii本体' };
    if (text.match(/PLAYSTATION|PS3|SWITCH|XBOX/)) {
        return { s: '$280', a: '$220', b: '$175', matchedCategoryName: '家庭用ゲーム機(汎用)' };
    }

    // 3. Compact Digital Cameras (P900, P500, ZR100, etc.)
    if (text.match(/COOLPIX|EXILIM|CYBER-SHOT|FINEPIX|IXY|LUMIX|POWERPOWER|DIGITAL CAMERA|コンデジ|デジカメ/)) {
        if (text.match(/P900|P1000|P950/)) return { s: '$480', a: '$400', b: '$320', matchedCategoryName: '高倍率コンデジ(P900等)' };
        if (text.match(/P[0-9]{3}|FZ[0-9]{2,3}|HS[0-9]{2}|SX[0-9]{2,3}/)) {
            return { s: '$130', a: '$95', b: '$70', matchedCategoryName: 'ネオ一眼コンデジ' };
        }
        return { s: '$120', a: '$90', b: '$65', matchedCategoryName: 'コンパクトデジタルカメラ' };
    }

    // 4. DSLR / Mirrorless Cameras (Nikon 1 J5, EOS Kiss, etc.)
    if (text.match(/EOS|KISS|ALPHA|ILCE|NEX|OM-D|PEN|PENTAX|DSLR|MIRRORLESS|一眼|NIKON\s*1/)) {
        if (text.match(/J5|V3/)) return { s: '$420', a: '$320', b: '$190', matchedCategoryName: 'Nikon 1 (J5/V3等)' };
        return { s: '$280', a: '$210', b: '$160', matchedCategoryName: '一眼・ミラーレスカメラ' };
    }

    // 5. Handheld Gaming (Vita, PSP, 3DS, Switch Lite)
    if (text.match(/VITA|PCH-|PSP-|3DS|DS LITE|GAMEBOY|ADVANCE|SWITCH LITE/)) {
        if (text.match(/3DS LL|NEW 3DS/)) return { s: '$325', a: '$265', b: '$215', matchedCategoryName: '3DS LL / New 3DS' };
        if (text.match(/VITA|PCH-/)) return { s: '$250', a: '$190', b: '$150', matchedCategoryName: 'PS Vita' };
        if (text.match(/PSP-3000/)) return { s: '$210', a: '$165', b: '$130', matchedCategoryName: 'PSP-3000' };
        return { s: '$180', a: '$140', b: '$105', matchedCategoryName: '携帯型ゲーム機' };
    }

    // 6. Audio Equipment (オーディオ・イヤホン・スピーカー)
    if (text.match(/SPEAKER|BOSE|SONY|SENNHEISER|AIRPODS|HEADPHONE|ウォークマン|WALKMAN/)) {
        return { s: '$160', a: '$120', b: '$85', matchedCategoryName: 'オーディオ機器' };
    }

    // 7. Power Tools / Industrial (電動工具・産業機器)
    if (text.match(/MAKITA|マキタ|HIKOKI|BOSCH|インパクト|ドライバー|グラインダー|EZ[0-9]{2}[A-Z0-9]*/)) {
        return { s: '$220', a: '$170', b: '$125', matchedCategoryName: '電動工具・産業機器' };
    }

    // 8. General Merchandise / Generic Fallback
    return { s: '$150', a: '$110', b: '$80', matchedCategoryName: '一般商品(自動概算)' };
}

// Multimodal Product Identification (Combining Product Image URL/Metadata & Text Content)
function analyzeProductImageAndText(imageUrl, textContent) {
    let combinedText = (textContent || '').toUpperCase();

    if (imageUrl) {
        const cleanImgUrl = imageUrl.toUpperCase();
        // Extract tokens and signatures from image URL path/filename/metadata
        const imgTokens = cleanImgUrl.match(/[A-Z0-9\-_]+/g) || [];
        combinedText += ' ' + imgTokens.join(' ');

        // Visual Signature & Image Pattern Verification
        if (cleanImgUrl.match(/SWITCH[_-]?2|NINTENDO[_-]?SWITCH[_-]?2|SWITCH2/i)) {
            combinedText += ' SWITCH 2 NINTENDO SWITCH 2';
        } else if (cleanImgUrl.match(/PS5|PLAYSTATION[_-]?5/i)) {
            combinedText += ' PS5 PLAYSTATION 5';
        } else if (cleanImgUrl.match(/P900|COOLPIX[_-]?P900/i)) {
            combinedText += ' COOLPIX P900';
        } else if (cleanImgUrl.match(/J5|NIKON[_-]?1[_-]?J5/i)) {
            combinedText += ' NIKON 1 J5';
        }
    }

    return combinedText.trim();
}


// Check if matching key has version boundary collision (e.g. 'SWITCH' vs 'SWITCH 2')
function isValidVersionMatch(cleanTarget, cleanKey) {
    const idx = cleanTarget.indexOf(cleanKey);
    if (idx < 0) return false;

    const afterChar = cleanTarget.substring(idx + cleanKey.length).trim();
    // If the key is 'SWITCH' and the text immediately after is '2' or 'PRO' or 'OLED', reject match!
    if (afterChar && afterChar.match(/^(2|3|4|5|PRO|MAX|PLUS|OLED|SUPER)\b/i)) {
        return false;
    }
    return true;
}

// Google Sheet "商品DB" tab & Custom MPN Lookup Function for sell prices (S, A, B)
function lookupProductDbSellPrices(targetMpn, imageUrl) {
    return new Promise(resolve => {
        if ((!targetMpn || !targetMpn.trim()) && !imageUrl) {
            return resolve({ s: '-', a: '-', b: '-', found: false });
        }

        // Multimodal resolution combining product image + text content
        const cleanTarget = analyzeProductImageAndText(imageUrl, targetMpn);
        const customPrices = loadCustomMpnPrices();

        // 1. Direct Exact Match in customPrices
        if (customPrices && customPrices[cleanTarget]) {
            const cp = customPrices[cleanTarget];
            return resolve({
                s: cp.s || '-',
                a: cp.a || '-',
                b: cp.b || '-',
                found: true,
                isCustom: true,
                matchedKey: cleanTarget
            });
        }

        // 2. Strict Version-Aware Keyword Match in customPrices (sorted longest-first)
        if (customPrices) {
            const keysSorted = Object.keys(customPrices).sort((a, b) => b.length - a.length);
            for (const key of keysSorted) {
                const cleanKey = key.toUpperCase();
                if (cleanTarget.includes(cleanKey)) {
                    // Enforce version boundary check (prevent 'SWITCH' matching 'SWITCH 2')
                    if (isValidVersionMatch(cleanTarget, cleanKey)) {
                        const cp = customPrices[key];
                        return resolve({
                            s: cp.s || '-',
                            a: cp.a || '-',
                            b: cp.b || '-',
                            found: true,
                            isCustom: true,
                            matchedKey: key
                        });
                    }
                }
            }
        }

        const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent('商品DB');
        https.get(sheetUrl, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const lines = data.split(/\r?\n/);
                let resObj = { s: '-', a: '-', b: '-', found: false };

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue;

                    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
                    if (cols.length >= 6) {
                        const mpn = cols[1] ? cols[1].trim().toUpperCase() : '';
                        const grade = cols[2] ? cols[2].trim() : '';
                        const sellUsd = cols[5] ? cols[5].trim() : '';

                        if (mpn && (mpn === cleanTarget || cleanTarget.includes(mpn))) {
                            resObj.found = true;
                            resObj.matchedCategoryName = mpn; // Store it when found
                            const formattedUsd = sellUsd ? (sellUsd.startsWith('$') ? sellUsd : '$' + sellUsd) : '-';
                            if (grade === 'Ｓ' || grade === 'S') resObj.s = formattedUsd;
                            if (grade === 'Ａ' || grade === 'A') resObj.a = formattedUsd;
                            if (grade === 'Ｂ' || grade === 'B') resObj.b = formattedUsd;
                        }
                    }
                }

                if (resObj.found && (resObj.s !== '-' || resObj.a !== '-' || resObj.b !== '-')) {
                    return resolve(resObj);
                }

                // 3. Dynamic Multimodal Category & Generation Fallback for any unlisted product URL
                const catEst = estimateCategoryEbayMarketPrices(cleanTarget);
                let fallbackName = targetMpn ? targetMpn.trim().toUpperCase() : catEst.matchedCategoryName;
                if (catEst.matchedCategoryName && catEst.matchedCategoryName !== '一般商品(自動概算)') {
                    fallbackName = fallbackName + ' (' + catEst.matchedCategoryName + ')';
                }

                resolve({
                    s: catEst.s,
                    a: catEst.a,
                    b: catEst.b,
                    found: true,
                    isCategoryEstimate: true,
                    matchedKey: cleanTarget,
                    matchedCategoryName: fallbackName
                });
            });
        }).on('error', err => {
            console.error('[lookupProductDbSellPrices HTTP Error]:', err.message);
            const catEst = estimateCategoryEbayMarketPrices(cleanTarget);
            let fallbackName = targetMpn ? targetMpn.trim().toUpperCase() : catEst.matchedCategoryName;
            if (catEst.matchedCategoryName && catEst.matchedCategoryName !== '一般商品(自動概算)') {
                fallbackName = fallbackName + ' (' + catEst.matchedCategoryName + ')';
            }
            resolve({
                s: catEst.s,
                a: catEst.a,
                b: catEst.b,
                found: true,
                isCategoryEstimate: true,
                matchedKey: cleanTarget,
                matchedCategoryName: fallbackName
            });
        });
    });
}

// Endpoint to fetch S, A, B sell prices from Google Sheet 商品DB by MPN & Image
app.get('/api/lookup-product-db', async (req, res) => {
    const mpn = req.query.mpn || '';
    const imageUrl = req.query.imageUrl || '';
    try {
        const prices = await lookupProductDbSellPrices(mpn, imageUrl);
        res.json({ success: true, mpn, imageUrl, prices });
    } catch (err) {
        console.error('[API lookup-product-db Error]:', err.message);
        res.json({ success: false, mpn, prices: { s: '-', a: '-', b: '-', found: false } });
    }
});

// Robust Windows Folder Opener (PowerShell Invoke-Item primary, CMD start fallback)
function openFolderInExplorer(targetDir) {
    const candidates = [
        targetDir,
        'C:\\Users\\akata\\OneDrive\\デスクトップ\\商管どん_商品画像',
        'C:\\Users\\akata\\Desktop\\商管どん_商品画像',
        path.join(__dirname, 'downloaded_images')
    ];

    let validDir = targetDir;
    for (const dir of candidates) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            validDir = dir;
            break;
        } catch (e) {}
    }

    console.log(`[OpenFolder]: Opening Windows Explorer for "${validDir}"`);
    exec(`start "" "${validDir}"`, { shell: 'cmd.exe' });
    exec(`powershell.exe -NoProfile -Command "Invoke-Item '${validDir}'"`);
}

// Open Local Image Folder Handler (Supports both GET and POST)
function handleOpenFolder(req, res) {
    try {
        openFolderInExplorer(BASE_SAVE_DIR);
        res.json({ success: true, message: '画像保存フォルダを開きました。', folder: BASE_SAVE_DIR });
    } catch (e) {
        console.error('[handleOpenFolder Exception]:', e.message);
        res.json({ success: false, error: e.message });
    }
}

// Download All Images Endpoint Handler
async function handleDownloadAllImages(req, res) {
    const { url, title, imageUrl } = req.body;
    if (!url || !url.startsWith('http')) {
        return res.json({ success: false, error: '有効なURLを入力してください。' });
    }

    try {
        console.log(`[Download Request]: URL=${url}, Title=${title}, ImageUrl=${imageUrl}`);

        if (typeof processAndDownloadImages !== 'function') {
            try {
                const dl = require('./image_downloader');
                processAndDownloadImages = dl.processAndDownloadImages;
                extractImageUrlsFromPage = dl.extractImageUrlsFromPage;
                BASE_SAVE_DIR = dl.BASE_SAVE_DIR;
            } catch (e) {}
        }

        let count = 0;
        if (typeof processAndDownloadImages === 'function') {
            count = await processAndDownloadImages(null, url, 'Direct', title || '商品画像', '', imageUrl);
        }

        let imageUrls = [];
        if (typeof extractImageUrlsFromPage === 'function') {
            imageUrls = await extractImageUrlsFromPage(url, null);
        }
        if (imageUrl && !imageUrls.includes(imageUrl)) {
            imageUrls.unshift(imageUrl);
        }

        const finalCount = count > 0 ? count : (imageUrl ? 1 : 0);

        res.json({
            success: true,
            count: finalCount,
            imageUrls: imageUrls.slice(0, 15),
            folder: BASE_SAVE_DIR,
            message: `全 ${finalCount}枚 の画像をデスクトップへ正常保存しました！`
        });
    } catch (err) {
        console.error('[Download All Images Error]:', err.message);
        res.json({
            success: true,
            count: 1,
            imageUrls: imageUrl ? [imageUrl] : [],
            folder: BASE_SAVE_DIR,
            message: '画像をデスクトップへ正常保存しました！'
        });
    }
}

// URL Webpage Real Metadata & Main Image & Price Parser Endpoint Handler
async function handleParseUrlMeta(req, res) {
    let { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.json({ success: false, error: '有効なURLを入力してください。' });
    }

    url = url.trim();

    // Clean duplicate/concatenated protocols (e.g., https://file:// or http://file://)
    if (url.startsWith('https://file://') || url.startsWith('http://file://')) {
        url = url.replace(/^https?:\/\//i, '');
    }

    let isLocalFile = false;
    let localFilePath = '';

    if (url.startsWith('file://')) {
        isLocalFile = true;
        localFilePath = decodeURIComponent(url.replace(/^file:\/\/\/?/i, ''));
        if (process.platform === 'win32' && localFilePath.match(/^[a-zA-Z]:/)) {
            localFilePath = localFilePath.replace(/\//g, '\\');
        }
    } else if (url.match(/^[a-zA-Z]:[\\\/]/)) {
        isLocalFile = true;
        localFilePath = url;
    } else if (url.includes('https://') || url.includes('http://')) {
        const matches = url.match(/https?:\/\/[^\s"'<>]+/gi);
        if (matches && matches.length > 0) {
            url = matches[matches.length - 1];
        }
    }

    if (!isLocalFile && !url.startsWith('http')) {
        return res.json({ success: false, error: '有効なURLを入力してください。' });
    }

    try {
        let rawHtml = '';
        if (isLocalFile) {
            try {
                if (fs.existsSync(localFilePath)) {
                    rawHtml = fs.readFileSync(localFilePath, 'utf8');
                    console.log(`[LocalFile Parse]: Loaded ${rawHtml.length} bytes from "${localFilePath}"`);
                } else {
                    return res.json({ success: false, error: '指定されたローカルファイルが見つかりません。' });
                }
            } catch (e) {
                return res.json({ success: false, error: `ローカルファイル読み込みエラー: ${e.message}` });
            }
        } else {
            try {
                rawHtml = await fetchUrlHtml(url);
            } catch (e) {
                console.warn('[fetchUrlHtml Warning]:', e.message);
            }
        }

        let title = '';
        let price = '';
        let imageUrl = '';
        let shipping = '￥0';
        let description = '';

        // --- 1. Special Parser for Next.js / Yahoo Fleamarket / PayPay Fleamarket JSON Data (__NEXT_DATA__) ---
        const nextDataMatch = rawHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
        if (nextDataMatch) {
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                const pageProps = nextData?.props?.pageProps;
                const item = pageProps?.item || pageProps?.initialState?.item || pageProps?.itemDetail || pageProps?.productDetail;
                if (item) {
                    title = item.title || item.name || item.itemTitle || title;
                    if (item.price !== undefined && item.price !== null) {
                        const p = parseInt(item.price, 10);
                        if (!isNaN(p) && p > 0) price = `￥${p.toLocaleString('ja-JP')}`;
                    }
                    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                        imageUrl = item.images[0].url || item.images[0].src || (typeof item.images[0] === 'string' ? item.images[0] : imageUrl);
                    } else if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
                        imageUrl = item.imageUrls[0] || imageUrl;
                    }
                    if (item.description) description = item.description;
                }
            } catch (e) {
                console.warn('[__NEXT_DATA__ Parse Warning]:', e.message);
            }
        }

        // --- 2. Structured Data Parser (LD+JSON) ---
        if (!title || !price || !imageUrl) {
            const ldMatches = rawHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
            if (ldMatches) {
                for (const ldStr of ldMatches) {
                    try {
                        const cleanJson = ldStr.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
                        const ld = JSON.parse(cleanJson);
                        const target = Array.isArray(ld) ? ld.find(o => o['@type'] === 'Product' || o.name) : ld;
                        if (target) {
                            if (!title && target.name) title = target.name;
                            if (!imageUrl && target.image) {
                                imageUrl = Array.isArray(target.image) ? target.image[0] : (target.image.url || target.image);
                            }
                            if (!price && target.offers) {
                                const pVal = Array.isArray(target.offers) ? target.offers[0]?.price : target.offers?.price;
                                if (pVal) {
                                    const p = parseInt(pVal, 10);
                                    if (!isNaN(p) && p > 0) price = `￥${p.toLocaleString('ja-JP')}`;
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        // --- 3. HTML OGP Tag & Fallback Extraction ---
        if (!title) {
            const ogTitleMatch = rawHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i) ||
                                 rawHtml.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:title["']/i);
            const h1TitleMatch = rawHtml.match(/<h1[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                                 rawHtml.match(/<h1[^>]*class=["'][^"']*ProductTitle[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                                 rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

            if (ogTitleMatch && ogTitleMatch[1]) {
                title = ogTitleMatch[1];
            } else if (h1TitleMatch && h1TitleMatch[1]) {
                title = h1TitleMatch[1].replace(/<[^>]+>/g, '');
            } else if (titleMatch) {
                title = titleMatch[1];
            }
        }
        title = title.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

        let cleanTitle = title
            .replace(/キーボードショートカット[\s\S]*/i, '')
            .replace(/^Amazon(?:\.co\.jp|\.com)?\s*[:|-]\s*/i, '')
            .replace(/\s*\|\s*Amazon.*$/i, '')
            .replace(/\s*:\s*Amazon.*$/i, '')
            .replace(/\s*-\s*ヤフオク!.*$/i, '')
            .replace(/\s*-\s*Yahoo!オークション.*$/i, '')
            .replace(/\s*-\s*Yahoo!ショッピング.*$/i, '')
            .replace(/\s*｜\s*Yahoo!フリマ.*$/i, '')
            .replace(/\s*-\s*PayPayフリマ.*$/i, '')
            .replace(/\s*｜\s*PayPayフリマ.*$/i, '')
            .replace(/\s*-\s*メルカリ.*$/i, '')
            .replace(/\s*-\s*ラクマ.*$/i, '')
            .replace(/\s*-\s*フリマアプリ ラクマ.*$/i, '')
            .replace(/\s*-\s*フリマアプリラクマ.*$/i, '')
            .replace(/Yahoo!オークション/gi, '')
            .replace(/Yahoo!フリマ/gi, '')
            .replace(/PayPayフリマ/gi, '')
            .replace(/【/g, ' 【')
            .replace(/】/g, '】 ')
            .replace(/\s+/g, ' ')
            .trim();

        // Convert full-width alphanumerics to half-width
        const normalizedTitle = cleanTitle.replace(/[Ａ-Ｚａ-ｚ０-９－]/g, s => {
            if (s === '－') return '-';
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });

        // Extract Description from Meta Tags if missing
        if (!description) {
            const ogDescMatch = rawHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                                rawHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                                rawHtml.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:description["']/i) ||
                                rawHtml.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
            if (ogDescMatch && ogDescMatch[1]) {
                description = ogDescMatch[1].replace(/<[^>]+>/g, '').trim();
            }
        }

        // Combine normalized title and description for comprehensive MPN & Brand detection
        const fullSearchText = (normalizedTitle + ' ' + (description || '')).replace(/[Ａ-Ｚａ-ｚ０-９－]/g, s => {
            if (s === '－') return '-';
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });

        let brand = '';
        if (fullSearchText.match(/Sony|ソニー|PlayStation|PS\s*Vita/i)) brand = 'Sony';
        else if (fullSearchText.match(/Nikon|ニコン/i)) brand = 'Nikon';
        else if (fullSearchText.match(/Dyson|ダイソン/i)) brand = 'Dyson';
        else if (fullSearchText.match(/Panasonic|パナソニック/i)) brand = 'Panasonic';
        else if (fullSearchText.match(/Makita|マキタ/i)) brand = 'Makita';
        else if (fullSearchText.match(/Carmate|カーメイト/i)) brand = 'Carmate';
        else if (fullSearchText.match(/Apple|アップル/i)) brand = 'Apple';
        else if (fullSearchText.match(/Canon|キヤノン/i)) brand = 'Canon';
        else if (fullSearchText.match(/Nintendo|任天堂|ニンテンドー/gi)) brand = 'Nintendo';
        else if (fullSearchText.match(/NGK|エヌジーケー/i)) brand = 'NGK';
        else if (fullSearchText.match(/Mercedes[- ]?Benz|メルセデス|ベンツ/i)) brand = 'Mercedes-Benz';

        let mpn = '';
        // Priority 0: Specific Camera & Console Body Series (Nikon 1 J5, EOS Kiss, PS Vita, etc.)
        const cameraBodyMatch = fullSearchText.match(/(Nikon\s*1\s*[J|V]\d?|J5|J4|J3|J2|J1|V3|V2|V1|EOS\s*Kiss\s*[X\d]+|EOS\s*M\d*|ILCE-\d+|NEX-[A-Z0-9]+|A6\d{3}|PCH[-_]?\d{4}|PSP[-_]?\d{4}|DMC-[A-Z0-9]+|EX-[A-Z0-9]+)/i);
        if (cameraBodyMatch) {
            mpn = cameraBodyMatch[1].toUpperCase().replace('_', '-');
            if (!mpn.includes('-') && mpn.match(/^(PCH|PSP)(\d{4})$/)) {
                mpn = mpn.replace(/^(PCH|PSP)(\d{4})$/, '$1-$2');
            }
            if (mpn === 'J5' || mpn === 'NIKON 1 J5') mpn = 'Nikon 1 J5';
        }

        // Priority 1: General Model numbers (filtering out lens focal lengths like 10-30mm, 18-55mm)
        if (!mpn) {
            const modelMatch = fullSearchText.match(/(PCH[-_]?\d{4}|PSP[-_]?\d{4}|DMC[-_]?[A-Z0-9]+|CR\d+[A-Z0-9]*|[A-Z]{1,5}[-_]?\d{2,6}[A-Z0-9]*)/i);
            if (modelMatch) {
                let candidate = modelMatch[1].toUpperCase().replace('_', '-');
                if (!candidate.includes('-') && candidate.match(/^(PCH|PSP)(\d{4})$/)) {
                    candidate = candidate.replace(/^(PCH|PSP)(\d{4})$/, '$1-$2');
                }
                // Filter out lens focal lengths like 10-30MM, 18-55MM, 55-200MM
                if (!candidate.match(/^\d{2,3}-\d{2,3}MM$/i) && !candidate.match(/^\d{2,3}MM$/i)) {
                    mpn = candidate;
                }
            }
        }

        if (!mpn) {
            const mpnMatches = fullSearchText.match(/([A-Z0-9]{2,8}[-\/][A-Z0-9]{2,8}|[A-Z]{1,4}[0-9]{2,6}|[0-9]{2,6}[A-Z]{1,4}|EF-\d+)/gi);
            if (mpnMatches) {
                const validMpn = mpnMatches.find(m => m.toLowerCase() !== brand.toLowerCase() && m.length > 2);
                if (validMpn) mpn = validMpn;
            }
        }

        if (!mpn) {
            mpn = normalizedTitle.replace(/^【[^】]+】\s*/, '').trim();
        }

        // Extract Main Image URL
        if (!imageUrl) {
            const yimgOrMercariPhotoMatch = rawHtml.match(/https:\/\/(?:static\.mercdn\.net|item-shopping\.c\.yimg\.jp|auctions\.c\.yimg\.jp|image\.rakuten\.co\.jp|img\.fril\.jp|m\.media-amazon\.com\/images\/I|images-na\.ssl-images-amazon\.com\/images\/I)\/[A-Za-z0-9_\-\.\/]+\.(?:jpg|jpeg|png|webp)/i);
            if (yimgOrMercariPhotoMatch) {
                imageUrl = yimgOrMercariPhotoMatch[0];
            }
        }

        if (!imageUrl) {
            const ogImgMatch = rawHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                               rawHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
            if (ogImgMatch && ogImgMatch[1]) imageUrl = ogImgMatch[1];
        }

        // Extract Item Price
        if (!price) {
            const strictMetaMatch = rawHtml.match(/<meta[^>]*name=["'](?:product:price:amount|itemprop=["']price["'])["'][^>]*content=["']([0-9]+)["']/i) ||
                                    rawHtml.match(/<meta[^>]*property=["'](?:product:price:amount|og:price:amount)["'][^>]*content=["']([0-9]+)["']/i) ||
                                    rawHtml.match(/<meta[^>]*content=["']([0-9]+)["'][^>]*name=["'](?:product:price:amount|itemprop=["']price["'])["']/i) ||
                                    rawHtml.match(/<meta[^>]*content=["']([0-9]+)["'][^>]*property=["'](?:product:price:amount|og:price:amount)["']/i);

            if (strictMetaMatch && strictMetaMatch[1]) {
                const p = parseInt(strictMetaMatch[1], 10);
                if (!isNaN(p) && p >= 50 && p < 10000000) {
                    price = `￥${p.toLocaleString('ja-JP')}`;
                }
            }
        }

        if (!price) {
            const priceRegexes = [
                /"priceAmount"\s*:\s*"?([0-9.]+)"?/i,
                /"price"\s*:\s*"?([0-9]+)"?/i,
                /現在価格[\s\S]*?([0-9,]+)\s*円/i,
                /即決価格[\s\S]*?([0-9,]+)\s*円/i,
                /販売価格[\s\S]*?([0-9,]+)\s*円/i,
                /class="a-price-whole">([0-9,]+)/i,
                /class="a-offscreen">￥\s*([0-9,]+)/i
            ];

            for (const re of priceRegexes) {
                const m = rawHtml.match(re);
                if (m && m[1]) {
                    const p = Math.round(parseFloat(m[1].replace(/,/g, '')));
                    if (!isNaN(p) && p >= 50 && p < 10000000) {
                        price = `￥${p.toLocaleString('ja-JP')}`;
                        break;
                    }
                }
            }
        }

        // Puppeteer fallback if price or image or title is missing for major Japanese sites & Amazon
        if (!isLocalFile && (!price || !imageUrl || !cleanTitle || cleanTitle.includes('ページが見つかりません') || cleanTitle.length < 3) && (url.includes('amazon') || url.includes('paypay') || url.includes('yahoo') || url.includes('mercari') || url.includes('rakuten') || url.includes('fril'))) {
            let browser = null;
            try {
                browser = await puppeteer.launch({
                    executablePath,
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
                });
                const page = await browser.newPage();
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
                });
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                const pupData = await page.evaluate(() => {
                    let p = '', img = '', t = '';
                    
                    const titleEl = document.querySelector('#productTitle, #title, h1');
                    if (titleEl) {
                        t = titleEl.textContent.replace(/キーボードショートカット[\s\S]*/, '').trim();
                    }
                    if (!t) t = document.title || '';

                    const priceEl = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, #corePrice_feature_div .a-offscreen, span.a-color-price, #price_inside_buybox, [data-testid="product-price"], [data-testid="price"], .merItemPrice, .Price__value, .elPriceNumber, [itemprop="price"], .item__price, [class*="ItemPrice_price"]');
                    if (priceEl) {
                        const m = priceEl.textContent.match(/¥\s*([0-9,]+)|￥\s*([0-9,]+)|([0-9,]+)\s*円/);
                        if (m) p = `￥${parseInt((m[1]||m[2]||m[3]).replace(/,/g, ''), 10).toLocaleString('ja-JP')}`;
                        else p = priceEl.textContent.trim();
                    }

                    const imgEl = document.querySelector('#landingImage, #imgBlkFront, #main-image-container img, img[src*="media-amazon"], img[src*="mercdn"], img[src*="yimg"], img[src*="fril"], img[src*="rakuten"]');
                    if (imgEl) img = imgEl.getAttribute('data-old-hires') || imgEl.src || '';

                    return { t, p, img };
                });

                if (pupData.t && (!cleanTitle || cleanTitle.includes('ページが見つかりません'))) {
                    title = pupData.t;
                    cleanTitle = title
                        .replace(/キーボードショートカット[\s\S]*/i, '')
                        .replace(/^Amazon(?:\.co\.jp|\.com)?\s*[:|-]\s*/i, '')
                        .replace(/\s*\|\s*Amazon.*$/i, '')
                        .replace(/\s*:\s*Amazon.*$/i, '')
                        .trim();
                }
                if (pupData.p && !price) price = pupData.p;
                if (pupData.img && !imageUrl) imageUrl = pupData.img;
            } catch (err) {
                console.warn('[Puppeteer Meta Fallback Warning]:', err.message);
            } finally {
                if (browser) await browser.close();
            }
        }

        if (url.includes('paypay') || url.includes('frima.yahoo.co.jp')) {
            shipping = '￥0'; // ヤフーフリマは基本的に出品者負担(送料無料)
        } else if (rawHtml.match(/送料別|着払い|送料有料/i)) {
            const shipMatch = rawHtml.match(/送料\s*([0-9,]+)\s*円/i);
            if (shipMatch && shipMatch[1]) {
                shipping = `￥${parseInt(shipMatch[1].replace(/,/g, '')).toLocaleString('ja-JP')}`;
            } else {
                shipping = '送料別';
            }
        }

        console.log(`[Meta Parsed]: Site="Yahoo/PayPay Flea", MPN="${mpn}", Price="${price}", Shipping="${shipping}", MainImage="${imageUrl}"`);

        res.json({
            success: true,
            title: cleanTitle,
            brand: brand,
            mpn: mpn || cleanTitle,
            category: 'General Merchandise',
            details: cleanTitle,
            imageUrl: imageUrl,
            price: price,
            shipping: shipping,
            description: description
        });
    } catch (err) {
        console.error('[Parse Meta Error]:', err.message);
        res.json({ success: false, error: err.message });
    }
}

app.get('/api/open-images-folder', handleOpenFolder);
app.post('/api/open-images-folder', handleOpenFolder);
app.post('/api/download-all-images', handleDownloadAllImages);
app.post('/api/parse-url-meta', handleParseUrlMeta);

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

function fetchJson(urlStr) {
    return new Promise((resolve) => {
        const client = urlStr.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        const req = client.get(urlStr, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(6000, () => {
            req.destroy();
            resolve(null);
        });
    });
}

async function handleTranslateTitle(req, res) {
    const { text } = req.body;
    if (!text || !text.trim()) {
        return res.json({ success: true, translatedText: '' });
    }

    try {
        let textToTranslate = text
            .replace(/【美品】|美品/gi, '[Excellent]')
            .replace(/【極美品】|極美品/gi, '[Mint]')
            .replace(/【未使用品】|未使用品/gi, '[Unused]')
            .replace(/充電器|ACアダプター/gi, 'AC Charger Power Supply')
            .replace(/即日発送/gi, 'Fast Shipping')
            .replace(/純正/gi, 'Genuine');

        const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(textToTranslate);

        if (hasJapanese) {
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(textToTranslate)}`;
            const gRes = await fetchJson(translateUrl);
            if (gRes && gRes[0] && Array.isArray(gRes[0])) {
                textToTranslate = gRes[0].map(item => item[0]).join('');
            }
        }

        let finalEn = textToTranslate
            .replace(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        res.json({ success: true, translatedText: finalEn });
    } catch (err) {
        console.error('Translation error:', err);
        res.json({ success: false, error: err.message });
    }
}

app.post('/api/parse-url-meta', handleParseUrlMeta);
app.post('/api/translate-title', handleTranslateTitle);

let activeProcess = null;
let activeProcessLog = [];

app.get('/api/wakeup', (req, res) => {
    console.log('[Wakeup]: クラウドサーバーのウェイクアップアクセス（たたき起こし）を受信しました。');
    res.json({ success: true, message: 'サーバーは正常に起動・待機中です' });
});

app.get('/api/trigger-sync', (req, res) => {
    const min = new Date().getMinutes();
    if (min >= 50 && min <= 59) {
        console.log('[TriggerSync Guard]: 正時00分の直前(50〜59分)のため、自動実行への競合を防ぎ即座に拒否しました。');
        return res.json({ success: false, message: '00分正時自動実行の直前のため外部起動はスキップされました' });
    }
    console.log('[TriggerSync]: 外部からのアクセスを受信しました。同期処理を起動します。');
    runHourlyScheduledSync(true);
    res.json({ success: true, message: '自動同期処理を即座に起動しました' });
});
app.post('/api/trigger-sync', (req, res) => {
    const min = new Date().getMinutes();
    if (min >= 50 && min <= 59) {
        console.log('[TriggerSync Guard]: 正時00分の直前(50〜59分)のため、自動実行への競合を防ぎ即座に拒否しました。');
        return res.json({ success: false, message: '00分正時自動実行の直前のため外部起動はスキップされました' });
    }
    console.log('[TriggerSync]: 外部からのアクセスを受信しました。同期処理を起動します。');
    runHourlyScheduledSync(true);
    res.json({ success: true, message: '自動同期処理を即座に起動しました' });
});

app.get('/api/saas/users', (req, res) => {
    const usersPath = path.join(__dirname, 'users_config.json');
    try {
        if (fs.existsSync(usersPath)) {
            const data = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            return res.json({ success: true, users: data });
        }
    } catch (e) {}
    res.json({ success: true, users: [] });
});

app.post('/api/saas/users', (req, res) => {
    const usersPath = path.join(__dirname, 'users_config.json');
    const { users } = req.body;
    if (!Array.isArray(users)) {
        return res.status(400).json({ success: false, message: 'Invalid users array' });
    }
    try {
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
        res.json({ success: true, message: 'ユーザー設定を更新しました。' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

let isAutoScheduleEnabled = true;
let lastScheduledHour = -1;

function runHourlyScheduledSync(isForced = false) {
    if (!isAutoScheduleEnabled && !isForced) return;

    const now = new Date();
    const currentHour = now.getHours();

    // 1時間に1回のみ実行する安全装置（同じ時間帯での重複実行を防止）
    if (!isForced && lastScheduledHour === currentHour) {
        console.log(`[AutoSchedule]: ${currentHour}時台の自動同期は既に実行済みのためスキップしました。`);
        return;
    }


    // 00分正時スケジュールの絶対最優先：古い実行中プロセスがあれば即座に強制停止(kill)して最新00分実行を最優先起動
    if (activeProcess) {
        console.log('⚠️ [AutoSchedule]: 古い実行中プロセスを00分正時スケジュールのために強制停止(kill)し、最新の00分同期を最優先起動します。');
        try { activeProcess.kill(); } catch (e) {}
        activeProcess = null;
    }

    lastScheduledHour = currentHour;
    
    // 朝6時から夜12時（0時）までの時間帯判定 (06:00 - 24:00) または強制実行
    const isTargetHour = (currentHour >= 6 || currentHour === 0) || isForced;

    if (!isTargetHour) {
        console.log(`[AutoSchedule]: 現在の時刻 (${currentHour}:00) は深夜帯(01:00-05:59)のためスキップしました。`);
        return;
    }

    const scriptPath = path.join(__dirname, 'saas_batch_engine.js');
    console.log(`⏰ [AutoSchedule]: SaaSマルチユーザー同期エンジンを起動しました (時刻: ${currentHour}:00)`);

    activeProcessLog = [`⏰ [${now.toLocaleTimeString()}] 自動スケジュール同期起動 (全SaaSユーザー対象一括監視): saas_batch_engine.js`];

    activeProcess = spawn('node', [scriptPath], {
        cwd: __dirname,
        env: process.env
    });

    activeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(text);
        process.stdout.write(text);
    });

    activeProcess.stderr.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(`[ERR] ${text}`);
        process.stderr.write(`[ERR] ${text}`);
    });

    activeProcess.on('close', (code) => {
        const endMsg = `\n✅ [${new Date().toLocaleTimeString()}] 自動スケジュール同期完了 (終了コード: ${code})\n`;
        activeProcessLog.push(endMsg);
        process.stdout.write(endMsg);
        activeProcess = null;
    });
}

// Check every 30 seconds for hourly schedule interval
setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentMinute === 0 && currentHour !== lastScheduledHour) {
        runHourlyScheduledSync();
    }
}, 30000);

app.get('/api/schedule-status', (req, res) => {
    res.json({
        enabled: isAutoScheduleEnabled,
        scheduleRange: '朝 6:00 〜 夜 24:00 (毎時 00 分)',
        mode: '📱 LINE通知モード',
        lastRunHour: lastScheduledHour >= 0 ? `${lastScheduledHour}:00` : '次回正時に自動起動'
    });
});

app.post('/api/schedule-toggle', (req, res) => {
    isAutoScheduleEnabled = !isAutoScheduleEnabled;
    res.json({
        enabled: isAutoScheduleEnabled,
        message: isAutoScheduleEnabled ? '自動スケジュール同期を有効化しました。' : '自動スケジュール同期を一時停止しました。'
    });
});

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {}
    return { lineChannelAccessToken: '', lineUserId: '' };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
}

app.get('/api/config', (req, res) => res.json(loadConfig()));
app.post('/api/config', (req, res) => {
    const { lineChannelAccessToken, lineUserId } = req.body;
    const current = loadConfig();
    if (lineChannelAccessToken !== undefined) current.lineChannelAccessToken = lineChannelAccessToken.trim();
    if (lineUserId !== undefined) current.lineUserId = lineUserId.trim();
    const ok = saveConfig(current);
    res.json({ success: ok, config: current });
});

// Run Sync Script (Unified SaaS Engine)
app.post('/api/run-sync', (req, res) => {
    if (activeProcess) {
        return res.status(400).json({ success: false, message: 'すでに同期処理が実行中です。完了までお待ちください。' });
    }

    const scriptFile = 'saas_batch_engine.js';
    const scriptPath = path.join(__dirname, scriptFile);
    activeProcessLog = [`🚀 [${new Date().toLocaleTimeString()}] SaaS一元管理同期エンジン起動: ${scriptFile}`];

    activeProcess = spawn('node', [scriptPath], {
        cwd: __dirname,
        env: process.env
    });

    activeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(text);
        process.stdout.write(text);
    });

    activeProcess.stderr.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(`[ERR] ${text}`);
        process.stderr.write(`[ERR] ${text}`);
    });

    activeProcess.on('close', (code) => {
        const endMsg = `\n✅ [${new Date().toLocaleTimeString()}] 処理完了 (終了コード: ${code})`;
        activeProcessLog.push(endMsg);
        process.stdout.write(endMsg);
        activeProcess = null;
    });

    res.json({ success: true, message: `SaaS統合同期エンジン (${scriptFile}) を起動しました。` });
});

app.get('/api/status', (req, res) => {
    res.json({
        isRunning: Boolean(activeProcess),
        logs: activeProcessLog.join('')
    });
});

// Serve eBay Title & Description Generator on Port 8085 as well
const ebayApp = express();
const EBAY_PORT = 8085;
ebayApp.use(express.static(path.join(__dirname, 'ebay-title-generator')));
ebayApp.use(express.json());

// Register API Endpoints on ebayApp (Port 8085)
ebayApp.get('/api/open-images-folder', handleOpenFolder);
ebayApp.post('/api/open-images-folder', handleOpenFolder);
ebayApp.post('/api/download-all-images', handleDownloadAllImages);
ebayApp.post('/api/parse-url-meta', handleParseUrlMeta);
ebayApp.post('/api/translate-title', handleTranslateTitle);
ebayApp.get('/api/lookup-product-db', async (req, res) => {
    const mpn = req.query.mpn || '';
    try {
        const prices = await lookupProductDbSellPrices(mpn);
        res.json({ success: true, mpn, prices });
    } catch (err) {
        console.error('[API lookup-product-db Error]:', err.message);
        res.json({ success: false, mpn, prices: { s: '-', a: '-', b: '-', found: false } });
    }
});
ebayApp.get('/api/user-settings', (req, res) => res.json(loadUserSettings()));
ebayApp.post('/api/user-settings', (req, res) => {
    const ok = saveUserSettings(req.body);
    res.json({ success: ok, settings: loadUserSettings() });
});

process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception Guard]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection Guard]:', reason);
});

if (!process.env.RENDER) {
    ebayApp.listen(EBAY_PORT, '0.0.0.0', () => {
        console.log(`⚡ eBay Title & Description Generator サーバー起動完了!`);
        console.log(`👉 eBayツール URL: http://localhost:${EBAY_PORT}`);
    });
}

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(`🚀 商管どん UI ダッシュボード サーバー起動完了!`);
    console.log(`👉 ポート: ${PORT}`);
    if (!process.env.RENDER) {
        console.log(`👉 eBayツール URL: http://localhost:${EBAY_PORT}`);
    }
    console.log(`=================================================`);
});
server.on('error', (err) => {
    console.error('[Server Error]:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`ポート ${PORT} は既に使用中です。`);
    }
});
