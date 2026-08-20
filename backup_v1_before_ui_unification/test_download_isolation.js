const { extractImageUrlsFromPage } = require('./image_downloader');

async function testIsolation() {
    console.log('Testing Yahoo Fleamarket Strict Image Isolation Logic...');
    
    // Yahoo Fleamarket Item URL
    const sampleUrl = 'https://paypayfleamarket.yahoo.co.jp/item/z300458922'; // ヤフーフリマ実商品URL
    
    try {
        const imageUrls = await extractImageUrlsFromPage(sampleUrl);
        console.log(`[Result]: Total ${imageUrls.length} images extracted.`);
        console.log('Extracted Image URLs:', imageUrls);
    } catch (e) {
        console.error('Test Error:', e.message);
    }
}

testIsolation();
