const { processAndDownloadImages, extractImageUrlsFromPage } = require('./image_downloader');

(async () => {
    const url = 'https://jp.mercari.com/item/m62808756184';
    console.log('Testing fast Mercari image downloader for:', url);
    const count = await processAndDownloadImages(null, url, 'DirectTest', '3DS充電器', '');
    console.log('Downloaded count:', count);
})();
