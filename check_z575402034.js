const { extractImageUrlsFromPage } = require('./image_downloader');

async function checkItemImages() {
    const targetUrl = 'https://paypayfleamarket.yahoo.co.jp/item/z575402034';
    console.log('Testing extraction for 21-photo item:', targetUrl);
    
    try {
        const imageUrls = await extractImageUrlsFromPage(targetUrl);
        console.log(`[EXTRACTED_COUNT]: ${imageUrls.length} images found!`);
        console.log('[IMAGE_URLS]:', imageUrls);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkItemImages();
