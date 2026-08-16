const { handleParseUrlMeta } = require('./server.js');

// Test Yahoo Fleamarket URL directly
const sampleUrl = 'https://paypayfleamarket.yahoo.co.jp/item/z328124234';

const req = {
    body: { url: sampleUrl }
};

const res = {
    json: function(data) {
        console.log('\n================ Parsed Result ================');
        console.log('Success:', data.success);
        console.log('Title:', data.title);
        console.log('Price:', data.price);
        console.log('ImageURL:', data.imageUrl);
        console.log('===============================================\n');
    }
};

(async () => {
    console.log(`Testing direct handleParseUrlMeta for Yahoo Fleamarket: ${sampleUrl}`);
    // Extract internal function test if exported or test parseUrlMeta logic
})();
