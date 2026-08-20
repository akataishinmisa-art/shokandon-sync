const { extractImageUrlsFromPage } = require('./image_downloader');

async function testYahooAuction() {
    console.log('Testing Yahoo Auction Image Extraction...');
    // Yahoo Auction test item URL
    const targetUrl = 'https://page.auctions.yahoo.co.jp/jp/auction/o1132649080'; // ヤフオク商品URL
    try {
        const urls = await extractImageUrlsFromPage(targetUrl);
        console.log(`[Yahoo Auction Result]: Extracted ${urls.length} images.`);
        console.log(urls);
    } catch(e) {
        console.error('Error:', e.message);
    }
}

testYahooAuction();
