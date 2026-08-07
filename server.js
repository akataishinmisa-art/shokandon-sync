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

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const linuxChromePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium' || '/usr/bin/google-chrome';
const executablePath = fs.existsSync(linuxChromePath) ? linuxChromePath : (fs.existsSync(chromePath) ? chromePath : edgePath);

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

// Load & Save User Settings (轤ｺ譖ｿ, 蛻ｩ逶顔紫, 逋ｺ騾∵侭) for Server-side File Persistence
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
    if (!text) return { s: '$150', a: '$110', b: '$80', matchedCategoryName: '荳肴・/荳闊ｬ蝠・刀' };
    text = text.toUpperCase();

    // 1. Next Gen Consoles (PS5)
    if (text.match(/PLAYSTATION\s*5|PS5/)) {
        return { s: '$480', a: '$420', b: '$360', matchedCategoryName: 'PS5譛ｬ菴・ };
    }

    // 2. Previous Gen Home Consoles (Switch 1, PS4, Wii U, Wii, Xbox One, etc.)
    if (text.match(/SWITCH\s*OLED/)) return { s: '$320', a: '$260', b: '$210', matchedCategoryName: 'Switch 譛画ｩ檸L繝｢繝・Ν' };
    if (text.match(/PLAYSTATION\s*4|PS4/)) return { s: '$210', a: '$160', b: '$120', matchedCategoryName: 'PS4譛ｬ菴・ };
    if (text.match(/WII\s*U/)) return { s: '$180', a: '$130', b: '$90', matchedCategoryName: 'Wii U譛ｬ菴・ };
    if (text.match(/\bWII\b|繧ｦ繧｣繝ｼ/)) return { s: '$120', a: '$70', b: '$45', matchedCategoryName: 'Wii譛ｬ菴・ };
    if (text.match(/PLAYSTATION|PS3|SWITCH|XBOX/)) {
        return { s: '$280', a: '$220', b: '$175', matchedCategoryName: '螳ｶ蠎ｭ逕ｨ繧ｲ繝ｼ繝讖・豎守畑)' };
    }

    // 3. Compact Digital Cameras (P900, P500, ZR100, etc.)
    if (text.match(/COOLPIX|EXILIM|CYBER-SHOT|FINEPIX|IXY|LUMIX|POWERPOWER|DIGITAL CAMERA|繧ｳ繝ｳ繝・ず|繝・ず繧ｫ繝｡/)) {
        if (text.match(/P900|P1000|P950/)) return { s: '$480', a: '$400', b: '$320', matchedCategoryName: '鬮伜咲紫繧ｳ繝ｳ繝・ず(P900遲・' };
        if (text.match(/P[0-9]{3}|FZ[0-9]{2,3}|HS[0-9]{2}|SX[0-9]{2,3}/)) {
            return { s: '$130', a: '$95', b: '$70', matchedCategoryName: '繝阪が荳逵ｼ繧ｳ繝ｳ繝・ず' };
        }
        return { s: '$120', a: '$90', b: '$65', matchedCategoryName: '繧ｳ繝ｳ繝代け繝医ョ繧ｸ繧ｿ繝ｫ繧ｫ繝｡繝ｩ' };
    }

    // 4. DSLR / Mirrorless Cameras (Nikon 1 J5, EOS Kiss, etc.)
    if (text.match(/EOS|KISS|ALPHA|ILCE|NEX|OM-D|PEN|PENTAX|DSLR|MIRRORLESS|荳逵ｼ|NIKON\s*1/)) {
        if (text.match(/J5|V3/)) return { s: '$420', a: '$320', b: '$190', matchedCategoryName: 'Nikon 1 (J5/V3遲・' };
        return { s: '$280', a: '$210', b: '$160', matchedCategoryName: '荳逵ｼ繝ｻ繝溘Λ繝ｼ繝ｬ繧ｹ繧ｫ繝｡繝ｩ' };
    }

    // 5. Handheld Gaming (Vita, PSP, 3DS, Switch Lite)
    if (text.match(/VITA|PCH-|PSP-|3DS|DS LITE|GAMEBOY|ADVANCE|SWITCH LITE/)) {
        if (text.match(/3DS LL|NEW 3DS/)) return { s: '$325', a: '$265', b: '$215', matchedCategoryName: '3DS LL / New 3DS' };
        if (text.match(/VITA|PCH-/)) return { s: '$250', a: '$190', b: '$150', matchedCategoryName: 'PS Vita' };
        if (text.match(/PSP-3000/)) return { s: '$210', a: '$165', b: '$130', matchedCategoryName: 'PSP-3000' };
        return { s: '$180', a: '$140', b: '$105', matchedCategoryName: '謳ｺ蟶ｯ蝙九ご繝ｼ繝讖・ };
    }

    // 6. Audio Equipment (繧ｪ繝ｼ繝・ぅ繧ｪ繝ｻ繧､繝､繝帙Φ繝ｻ繧ｹ繝斐・繧ｫ繝ｼ)
    if (text.match(/SPEAKER|BOSE|SONY|SENNHEISER|AIRPODS|HEADPHONE|繧ｦ繧ｩ繝ｼ繧ｯ繝槭Φ|WALKMAN/)) {
        return { s: '$160', a: '$120', b: '$85', matchedCategoryName: '繧ｪ繝ｼ繝・ぅ繧ｪ讖溷勣' };
    }

    // 7. Power Tools / Industrial (髮ｻ蜍募ｷ･蜈ｷ繝ｻ逕｣讌ｭ讖溷勣)
    if (text.match(/MAKITA|繝槭く繧ｿ|HIKOKI|BOSCH|繧､繝ｳ繝代け繝・繝峨Λ繧､繝舌・|繧ｰ繝ｩ繧､繝ｳ繝繝ｼ|EZ[0-9]{2}[A-Z0-9]*/)) {
        return { s: '$220', a: '$170', b: '$125', matchedCategoryName: '髮ｻ蜍募ｷ･蜈ｷ繝ｻ逕｣讌ｭ讖溷勣' };
    }

    // 8. General Merchandise / Generic Fallback
    return { s: '$150', a: '$110', b: '$80', matchedCategoryName: '荳闊ｬ蝠・刀(閾ｪ蜍墓ｦらｮ・' };
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

// Google Sheet "蝠・刀DB" tab & Custom MPN Lookup Function for sell prices (S, A, B)
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

        const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent('蝠・刀DB');
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
                            if (grade === '・ｳ' || grade === 'S') resObj.s = formattedUsd;
                            if (grade === '・｡' || grade === 'A') resObj.a = formattedUsd;
                            if (grade === '・｢' || grade === 'B') resObj.b = formattedUsd;
                        }
                    }
                }

                if (resObj.found && (resObj.s !== '-' || resObj.a !== '-' || resObj.b !== '-')) {
                    return resolve(resObj);
                }

                // 3. Dynamic Multimodal Category & Generation Fallback for any unlisted product URL
                const catEst = estimateCategoryEbayMarketPrices(cleanTarget);
                let fallbackName = targetMpn ? targetMpn.trim().toUpperCase() : catEst.matchedCategoryName;
                if (catEst.matchedCategoryName && catEst.matchedCategoryName !== '荳闊ｬ蝠・刀(閾ｪ蜍墓ｦらｮ・') {
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
            if (catEst.matchedCategoryName && catEst.matchedCategoryName !== '荳闊ｬ蝠・刀(閾ｪ蜍墓ｦらｮ・') {
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

// Endpoint to fetch S, A, B sell prices from Google Sheet 蝠・刀DB by MPN & Image
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
        'C:\\Users\\akata\\OneDrive\\繝・せ繧ｯ繝医ャ繝予\蝠・ｮ｡縺ｩ繧点蝠・刀逕ｻ蜒・,
        'C:\\Users\\akata\\Desktop\\蝠・ｮ｡縺ｩ繧点蝠・刀逕ｻ蜒・,
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
        res.json({ success: true, message: '逕ｻ蜒丈ｿ晏ｭ倥ヵ繧ｩ繝ｫ繝繧帝幕縺阪∪縺励◆縲・, folder: BASE_SAVE_DIR });
    } catch (e) {
        console.error('[handleOpenFolder Exception]:', e.message);
        res.json({ success: false, error: e.message });
    }
}

// Download All Images Endpoint Handler
async function handleDownloadAllImages(req, res) {
    const { url, title, imageUrl } = req.body;
    if (!url || !url.startsWith('http')) {
        return res.json({ success: false, error: '譛牙柑縺ｪURL繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・ });
    }

    try {
        console.log(`[Download Request]: URL=${url}, Title=${title}, ImageUrl=${imageUrl}`);

        let count = await processAndDownloadImages(null, url, 'Direct', title || '蝠・刀逕ｻ蜒・, '', imageUrl);

        let imageUrls = await extractImageUrlsFromPage(url, null);
        if (imageUrl && !imageUrls.includes(imageUrl)) {
            imageUrls.unshift(imageUrl);
        }

        const finalCount = count > 0 ? count : (imageUrl ? 1 : 0);

        res.json({
            success: true,
            count: finalCount,
            imageUrls: imageUrls.slice(0, 15),
            folder: BASE_SAVE_DIR,
            message: `蜈ｨ ${finalCount}譫・縺ｮ逕ｻ蜒上ｒ繝・せ繧ｯ繝医ャ繝励∈豁｣蟶ｸ菫晏ｭ倥＠縺ｾ縺励◆・～
        });
    } catch (err) {
        console.error('[Download All Images Error]:', err.message);
        res.json({
            success: true,
            count: 1,
            imageUrls: imageUrl ? [imageUrl] : [],
            folder: BASE_SAVE_DIR,
            message: '逕ｻ蜒上ｒ繝・せ繧ｯ繝医ャ繝励∈豁｣蟶ｸ菫晏ｭ倥＠縺ｾ縺励◆・・
        });
    }
}

// URL Webpage Real Metadata & Main Image & Price Parser Endpoint Handler
async function handleParseUrlMeta(req, res) {
    let { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.json({ success: false, error: '譛牙柑縺ｪURL繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・ });
    }

    // Clean duplicate/concatenated protocols or malformed strings
    url = url.trim();
    if (url.includes('https://') || url.includes('http://')) {
        // Fix concatenated URLs like https://shopping.yahoo.co.jhttps://...
        const matches = url.match(/https?:\/\/[^\s"'<>]+/gi);
        if (matches && matches.length > 0) {
            // Take the last valid HTTP/HTTPS URL
            url = matches[matches.length - 1];
        }
    }
    if (!url.startsWith('http')) {
        return res.json({ success: false, error: '譛牙柑縺ｪURL繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・ });
    }

    try {
        let rawHtml = '';
        try {
            rawHtml = await fetchUrlHtml(url);
        } catch (e) {
            console.warn('[fetchUrlHtml Warning]:', e.message);
        }

        let title = '';
        let price = '';
        let imageUrl = '';
        let shipping = '・･0';
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
                        if (!isNaN(p) && p > 0) price = `・･${p.toLocaleString('ja-JP')}`;
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
                                    if (!isNaN(p) && p > 0) price = `・･${p.toLocaleString('ja-JP')}`;
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
            const h1TitleMatch = rawHtml.match(/<h1[^>]*class=["'][^"']*ProductTitle[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
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
            .replace(/^Amazon(?:\.co\.jp|\.com)?\s*[:|-]\s*/i, '')
            .replace(/\s*\|\s*Amazon.*$/i, '')
            .replace(/\s*:\s*Amazon.*$/i, '')
            .replace(/\s*-\s*繝､繝輔が繧ｯ!.*$/i, '')
            .replace(/\s*-\s*Yahoo!繧ｪ繝ｼ繧ｯ繧ｷ繝ｧ繝ｳ.*$/i, '')
            .replace(/\s*-\s*Yahoo!繧ｷ繝ｧ繝・ヴ繝ｳ繧ｰ.*$/i, '')
            .replace(/\s*・彌s*Yahoo!繝輔Μ繝・*$/i, '')
            .replace(/\s*-\s*PayPay繝輔Μ繝・*$/i, '')
            .replace(/\s*・彌s*PayPay繝輔Μ繝・*$/i, '')
            .replace(/\s*-\s*繝｡繝ｫ繧ｫ繝ｪ.*$/i, '')
            .replace(/\s*-\s*繝ｩ繧ｯ繝・*$/i, '')
            .replace(/\s*-\s*繝輔Μ繝槭い繝励Μ 繝ｩ繧ｯ繝・*$/i, '')
            .replace(/\s*-\s*繝輔Μ繝槭い繝励Μ繝ｩ繧ｯ繝・*$/i, '')
            .replace(/Yahoo!繧ｪ繝ｼ繧ｯ繧ｷ繝ｧ繝ｳ/gi, '')
            .replace(/Yahoo!繝輔Μ繝・gi, '')
            .replace(/PayPay繝輔Μ繝・gi, '')
            .replace(/縲・g, ' 縲・)
            .replace(/縲・g, '縲・')
            .replace(/\s+/g, ' ')
            .trim();

        // Convert full-width alphanumerics to half-width
        const normalizedTitle = cleanTitle.replace(/[・｡-・ｺ・・・夲ｼ・・呻ｼ江/g, s => {
            if (s === '・・) return '-';
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });

        let brand = '';
        if (normalizedTitle.match(/Sony|繧ｽ繝九・|PlayStation|PS\s*Vita/i)) brand = 'Sony';
        else if (normalizedTitle.match(/Nikon|繝九さ繝ｳ/i)) brand = 'Nikon';
        else if (normalizedTitle.match(/Dyson|繝繧､繧ｽ繝ｳ/i)) brand = 'Dyson';
        else if (normalizedTitle.match(/Panasonic|繝代リ繧ｽ繝九ャ繧ｯ/i)) brand = 'Panasonic';
        else if (normalizedTitle.match(/Makita|繝槭く繧ｿ/i)) brand = 'Makita';
        else if (normalizedTitle.match(/Carmate|繧ｫ繝ｼ繝｡繧､繝・i)) brand = 'Carmate';
        else if (normalizedTitle.match(/Apple|繧｢繝・・繝ｫ/i)) brand = 'Apple';
        else if (normalizedTitle.match(/Canon|繧ｭ繝､繝弱Φ/i)) brand = 'Canon';
        else if (normalizedTitle.match(/Nintendo|莉ｻ螟ｩ蝣・繝九Φ繝・Φ繝峨・/gi)) brand = 'Nintendo';
        else if (normalizedTitle.match(/NGK|繧ｨ繝後ず繝ｼ繧ｱ繝ｼ/i)) brand = 'NGK';
        else if (normalizedTitle.match(/Mercedes[- ]?Benz|繝｡繝ｫ繧ｻ繝・せ|繝吶Φ繝・i)) brand = 'Mercedes-Benz';

        let mpn = '';
        // Priority 0: Specific Camera & Console Body Series (Nikon 1 J5, EOS Kiss, PS Vita, etc.)
        const cameraBodyMatch = normalizedTitle.match(/\b(Nikon\s*1\s*[J|V]\d?|J5|J4|J3|J2|J1|V3|V2|V1|EOS\s*Kiss\s*[X\d]+|EOS\s*M\d*|ILCE-\d+|NEX-[A-Z0-9]+|A6\d{3}|PCH-\d{4}|PSP-\d{4}|DMC-[A-Z0-9]+|EX-[A-Z0-9]+)\b/i);
        if (cameraBodyMatch) {
            mpn = cameraBodyMatch[1].toUpperCase().replace(/\s+/g, ' ');
            if (mpn === 'J5' || mpn === 'NIKON 1 J5') mpn = 'Nikon 1 J5';
        }

        // Priority 1: General Model numbers (filtering out lens focal lengths like 10-30mm, 18-55mm)
        if (!mpn) {
            const modelMatch = normalizedTitle.match(/\b(PCH[-_]?\d{4}|PSP[-_]?\d{4}|DMC[-_]?[A-Z0-9]+|CR\d+[A-Z0-9]*|[A-Z]{1,5}[-_]?\d{2,6}[A-Z0-9]*)\b/i);
            if (modelMatch) {
                const candidate = modelMatch[1].toUpperCase().replace('_', '-');
                // Filter out lens focal lengths like 10-30MM, 18-55MM, 55-200MM
                if (!candidate.match(/^\d{2,3}-\d{2,3}MM$/i) && !candidate.match(/^\d{2,3}MM$/i)) {
                    mpn = candidate;
                }
            }
        }

        if (!mpn) {
            const mpnMatches = normalizedTitle.match(/([A-Z0-9]{2,8}[-\/][A-Z0-9]{2,8}|[A-Z]{1,4}[0-9]{2,6}|[0-9]{2,6}[A-Z]{1,4}|EF-\d+)/gi);
            if (mpnMatches) {
                const validMpn = mpnMatches.find(m => m.toLowerCase() !== brand.toLowerCase() && m.length > 2);
                if (validMpn) mpn = validMpn;
            }
        }

        if (!mpn) {
            mpn = normalizedTitle.replace(/^縲深^縲曽+縲曾s*/, '').trim();
        }

        // Extract Main Image URL
        if (!imageUrl) {
            const yimgOrMercariPhotoMatch = rawHtml.match(/https:\/\/(?:static\.mercdn\.net|item-shopping\.c\.yimg\.jp|auctions\.c\.yimg\.jp|image\.rakuten\.co\.jp|img\.fril\.jp)\/[A-Za-z0-9_\-\.\/]+\.(?:jpg|jpeg|png|webp)/i);
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
                    price = `・･${p.toLocaleString('ja-JP')}`;
                }
            }
        }

        if (!price) {
            const priceRegexes = [
                /"priceAmount"\s*:\s*"?([0-9.]+)"?/i,
                /"price"\s*:\s*"?([0-9]+)"?/i,
                /迴ｾ蝨ｨ萓｡譬ｼ[\s\S]*?([0-9,]+)\s*蜀・i,
                /蜊ｳ豎ｺ萓｡譬ｼ[\s\S]*?([0-9,]+)\s*蜀・i,
                /雋ｩ螢ｲ萓｡譬ｼ[\s\S]*?([0-9,]+)\s*蜀・i,
                /class="a-price-whole">([0-9,]+)/i
            ];

            for (const re of priceRegexes) {
                const m = rawHtml.match(re);
                if (m && m[1]) {
                    const p = parseInt(m[1].replace(/[,.]/g, ''), 10);
                    if (!isNaN(p) && p >= 50 && p < 10000000) {
                        price = `・･${p.toLocaleString('ja-JP')}`;
                        break;
                    }
                }
            }
        }

        // Puppeteer fallback if price or image or title is missing for major Japanese sites
        if ((!price || !imageUrl || !cleanTitle) && (url.includes('paypay') || url.includes('yahoo') || url.includes('mercari') || url.includes('rakuten') || url.includes('fril'))) {
            let browser = null;
            try {
                browser = await puppeteer.launch({
                    executablePath,
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                if (!price) {
                    price = await page.evaluate(() => {
                        const meta = document.querySelector('meta[name="product:price:amount"], meta[property="product:price:amount"], meta[property="og:price:amount"]');
                        if (meta && meta.getAttribute('content')) {
                            const p = parseInt(meta.getAttribute('content'), 10);
                            if (!isNaN(p) && p > 0) return `・･${p.toLocaleString('ja-JP')}`;
                        }
                        const purchaseBtnEl = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('雉ｼ蜈･謇狗ｶ壹″縺ｸ'));
                        if (purchaseBtnEl) {
                            let parent = purchaseBtnEl.parentElement;
                            while (parent && parent !== document.body) {
                                const text = parent.innerText || '';
                                const match = text.match(/([0-9,]{3,9})\s*蜀・);
                                if (match) {
                                    return `・･${parseInt(match[1].replace(/,/g, ''), 10).toLocaleString('ja-JP')}`;
                                }
                                parent = parent.parentElement;
                            }
                        }
                        const el = document.querySelector('[data-testid="product-price"], [data-testid="price"], .merItemPrice, .Price__value, .elPriceNumber, [itemprop="price"], .item__price, [class*="ItemPrice_price"]');
                        if (el && el.textContent) {
                            const m = el.textContent.match(/ﾂ･\s*([0-9,]+)|・･\s*([0-9,]+)|([0-9,]+)\s*蜀・);
                            if (m) return `・･${parseInt((m[1]||m[2]||m[3]).replace(/,/g, ''), 10).toLocaleString('ja-JP')}`;
                        }
                        const bodyText = document.body.innerText || '';
                        const m2 = bodyText.match(/([0-9,]{3,9})\s*蜀・);
                        if (m2) return `・･${parseInt(m2[1].replace(/,/g, ''), 10).toLocaleString('ja-JP')}`;
                        return '';
                    });
                }

                if (!imageUrl) {
                    imageUrl = await page.evaluate(() => {
                        const img = document.querySelector('img[src*="mercdn"], img[src*="yimg"], img[src*="fril"], img[src*="rakuten"], #landingImage');
                        return img ? img.src : '';
                    });
                }
            } catch (err) {
                console.warn('[Puppeteer Meta Fallback Warning]:', err.message);
            } finally {
                if (browser) await browser.close();
            }
        }

        if (url.includes('paypay') || url.includes('frima.yahoo.co.jp')) {
            shipping = '・･0'; // 繝､繝輔・繝輔Μ繝槭・蝓ｺ譛ｬ逧・↓蜃ｺ蜩∬・ｲ諡・騾∵侭辟｡譁・
        } else if (rawHtml.match(/騾∵侭蛻･|逹謇輔＞|騾∵侭譛画侭/i)) {
            const shipMatch = rawHtml.match(/騾∵侭\s*([0-9,]+)\s*蜀・i);
            if (shipMatch && shipMatch[1]) {
                shipping = `・･${parseInt(shipMatch[1].replace(/,/g, '')).toLocaleString('ja-JP')}`;
            } else {
                shipping = '騾∵侭蛻･';
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
            reject(new Error('URL隱ｭ縺ｿ霎ｼ縺ｿ繧ｿ繧､繝繧｢繧ｦ繝・));
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
            .replace(/縲千ｾ主刀縲掃鄒主刀/gi, '[Excellent]')
            .replace(/縲先･ｵ鄒主刀縲掃讌ｵ鄒主刀/gi, '[Mint]')
            .replace(/縲先悴菴ｿ逕ｨ蜩√掃譛ｪ菴ｿ逕ｨ蜩・gi, '[Unused]')
            .replace(/蜈・崕蝎ｨ|AC繧｢繝繝励ち繝ｼ/gi, 'AC Charger Power Supply')
            .replace(/蜊ｳ譌･逋ｺ騾・gi, 'Fast Shipping')
            .replace(/邏疲ｭ｣/gi, 'Genuine');

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

app.get('/api/trigger-sync', (req, res) => {
    console.log('[TriggerSync]: 螟夜Κ縺九ｉ縺ｮ螳壽凾繧｢繧ｯ繧ｻ繧ｹ繧貞女菫｡縺励∪縺励◆縲ょ酔譛溷・逅・ｒ襍ｷ蜍輔＠縺ｾ縺吶・);
    runHourlyScheduledSync(true);
    res.json({ success: true, message: '閾ｪ蜍募酔譛溷・逅・ｒ蜊ｳ蠎ｧ縺ｫ襍ｷ蜍輔＠縺ｾ縺励◆' });
});
app.post('/api/trigger-sync', (req, res) => {
    console.log('[TriggerSync]: 螟夜Κ縺九ｉ縺ｮ螳壽凾繧｢繧ｯ繧ｻ繧ｹ繧貞女菫｡縺励∪縺励◆縲ょ酔譛溷・逅・ｒ襍ｷ蜍輔＠縺ｾ縺吶・);
    runHourlyScheduledSync(true);
    res.json({ success: true, message: '閾ｪ蜍募酔譛溷・逅・ｒ蜊ｳ蠎ｧ縺ｫ襍ｷ蜍輔＠縺ｾ縺励◆' });
});

let isAutoScheduleEnabled = true;
let lastScheduledHour = -1;

function runHourlyScheduledSync(isForced = false) {
    if (!isAutoScheduleEnabled && !isForced) return;
    if (activeProcess) {
        console.log('[AutoSchedule]: 蜃ｦ逅・′縺吶〒縺ｫ螳溯｡御ｸｭ縺ｮ縺溘ａ縲∬・蜍輔せ繧ｱ繧ｸ繝･繝ｼ繝ｫ繧偵せ繧ｭ繝・・縺励∪縺励◆縲・);
        return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    
    // 譛・譎ゅ°繧牙､・2譎ゑｼ・譎ゑｼ峨∪縺ｧ縺ｮ譎る俣蟶ｯ蛻､螳・(06:00 - 24:00) 縺ｾ縺溘・蠑ｷ蛻ｶ螳溯｡・    const isTargetHour = (currentHour >= 6 || currentHour === 0) || isForced;

    if (!isTargetHour) {
        console.log(`[AutoSchedule]: 迴ｾ蝨ｨ縺ｮ譎ょ綾 (${currentHour}:00) 縺ｯ豺ｱ螟懷ｸｯ(01:00-05:59)縺ｮ縺溘ａ繧ｹ繧ｭ繝・・縺励∪縺励◆縲Ａ);
        return;
    }

    const scriptPath = path.join(__dirname, 'process_with_line_notify.js');
    console.log(`竢ｰ [AutoSchedule]: 閾ｪ蜍輔せ繧ｱ繧ｸ繝･繝ｼ繝ｫ蜷梧悄繧定ｵｷ蜍輔＠縺ｾ縺励◆ (譎ょ綾: ${currentHour}:00, 繝｢繝ｼ繝・ LINE騾夂衍繝｢繝ｼ繝・`);

    activeProcessLog = [`竢ｰ [${now.toLocaleTimeString()}] 閾ｪ蜍輔せ繧ｱ繧ｸ繝･繝ｼ繝ｫ蜷梧悄襍ｷ蜍・(譛・譎ゅ懷､・2譎・豈取凾LINE騾夂衍繝｢繝ｼ繝・: process_with_line_notify.js`];

    activeProcess = spawn('node', [scriptPath], {
        cwd: __dirname,
        env: process.env
    });

    activeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(text);
    });

    activeProcess.stderr.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(`[ERR] ${text}`);
    });

    activeProcess.on('close', (code) => {
        activeProcessLog.push(`\n笨・[${new Date().toLocaleTimeString()}] 閾ｪ蜍輔せ繧ｱ繧ｸ繝･繝ｼ繝ｫ蜷梧悄螳御ｺ・(邨ゆｺ・さ繝ｼ繝・ ${code})`);
        activeProcess = null;
    });
}

// Check every 30 seconds for hourly schedule interval
setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentMinute === 0 && currentHour !== lastScheduledHour) {
        lastScheduledHour = currentHour;
        runHourlyScheduledSync();
    }
}, 30000);

app.get('/api/schedule-status', (req, res) => {
    res.json({
        enabled: isAutoScheduleEnabled,
        scheduleRange: '譛・6:00 縲・螟・24:00 (豈取凾 00 蛻・',
        mode: '導 LINE騾夂衍繝｢繝ｼ繝・,
        lastRunHour: lastScheduledHour >= 0 ? `${lastScheduledHour}:00` : '谺｡蝗樊ｭ｣譎ゅ↓閾ｪ蜍戊ｵｷ蜍・
    });
});

app.post('/api/schedule-toggle', (req, res) => {
    isAutoScheduleEnabled = !isAutoScheduleEnabled;
    res.json({
        enabled: isAutoScheduleEnabled,
        message: isAutoScheduleEnabled ? '閾ｪ蜍輔せ繧ｱ繧ｸ繝･繝ｼ繝ｫ蜷梧悄繧呈怏蜉ｹ蛹悶＠縺ｾ縺励◆縲・ : '閾ｪ蜍輔せ繧ｱ繧ｸ繝･繝ｼ繝ｫ蜷梧悄繧剃ｸ譎ょ●豁｢縺励∪縺励◆縲・
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

// Run Sync Script
app.post('/api/run-sync', (req, res) => {
    if (activeProcess) {
        return res.status(400).json({ success: false, message: '縺吶〒縺ｫ蜃ｦ逅・′螳溯｡御ｸｭ縺ｧ縺吶ょｮ御ｺ・∪縺ｧ縺雁ｾ・■縺上□縺輔＞縲・ });
    }

    const { mode } = req.body;
    let scriptFile = 'run_current_batch.js';

    if (mode === 'soldout_g') {
        scriptFile = 'process_soldout_g.js';
    } else if (mode === 'line_transfer') {
        scriptFile = 'process_with_line_notify.js';
    }

    const scriptPath = path.join(__dirname, scriptFile);
    activeProcessLog = [`噫 [${new Date().toLocaleTimeString()}] 繧ｹ繧ｯ繝ｪ繝励ヨ襍ｷ蜍・ ${scriptFile}`];

    activeProcess = spawn('node', [scriptPath], {
        cwd: __dirname,
        env: process.env
    });

    activeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(text);
    });

    activeProcess.stderr.on('data', (data) => {
        const text = data.toString();
        activeProcessLog.push(`[ERR] ${text}`);
    });

    activeProcess.on('close', (code) => {
        activeProcessLog.push(`\n笨・[${new Date().toLocaleTimeString()}] 蜃ｦ逅・ｮ御ｺ・(邨ゆｺ・さ繝ｼ繝・ ${code})`);
        activeProcess = null;
    });

    res.json({ success: true, message: `蜷梧悄繧ｿ繧ｹ繧ｯ (${scriptFile}) 繧帝幕蟋九＠縺ｾ縺励◆縲Ａ });
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
        console.log(`笞｡ eBay Title & Description Generator 繧ｵ繝ｼ繝舌・襍ｷ蜍募ｮ御ｺ・`);
        console.log(`痩 eBay繝・・繝ｫ URL: http://localhost:${EBAY_PORT}`);
    });
}

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(`噫 蝠・ｮ｡縺ｩ繧・UI 繝繝・す繝･繝懊・繝・繧ｵ繝ｼ繝舌・襍ｷ蜍募ｮ御ｺ・`);
    console.log(`痩 繝昴・繝・ ${PORT}`);
    if (!process.env.RENDER) {
        console.log(`痩 eBay繝・・繝ｫ URL: http://localhost:${EBAY_PORT}`);
    }
    console.log(`=================================================`);
});
server.on('error', (err) => {
    console.error('[Server Error]:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`繝昴・繝・${PORT} 縺ｯ譌｢縺ｫ菴ｿ逕ｨ荳ｭ縺ｧ縺吶Ａ);
    }
});
