const { processAndDownloadImages, extractImageUrlsFromPage } = require('./image_downloader');

(async () => {
    const url = 'https://www.amazon.co.jp/Aumotop-Aumot54a0fhvwq1-7%E8%89%B2%E3%81%AE%E3%82%A2%E3%83%B3%E3%83%93%E3%82%A8%E3%83%B3%E3%83%88%E7%85%A7%E6%98%8EMercedesbenz-Sclass-20142017%E3%81%AELED%E5%9B%9E%E8%BB%A2%E3%83%84%E3%82%A4%E3%83%BC%E3%82%BF%E3%83%BC%E4%BA%A4%E6%8F%9B/dp/B0DXW412HY/';
    console.log('Testing full image extraction for Amazon item:', url);

    const urls = await extractImageUrlsFromPage(url, null);
    console.log('Extracted URLs count:', urls.length);
    urls.forEach((u, i) => console.log(`Url ${i+1}: ${u}`));

    const count = await processAndDownloadImages(null, url, 'TestB0DXW412HY', 'Mercedes_Speaker', '');
    console.log('Total downloaded count:', count);
})();
