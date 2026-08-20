const https = require('https');

function testMercariApi(keyword) {
    const postData = JSON.stringify({
        userId: "",
        pageSize: 30,
        pageToken: "",
        searchSessionId: "test_session",
        indexRouting: "INDEX_ROUTING_UNSPECIFIED",
        thumbnailTypes: [],
        searchMode: "SEARCH_MODE_DEFAULT",
        customerType: "CUSTOMER_TYPE_UNSPECIFIED",
        keyword: keyword,
        status: ["STATUS_ON_SALE"],
        itemConditionId: [1, 2, 3],
        sort: "SORT_CREATED_TIME",
        order: "ORDER_DESC"
    });

    const options = {
        hostname: 'api.mercari.jp',
        port: 443,
        path: '/v2/entities:search',
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Content-Type': 'application/json',
            'X-Platform': 'web',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Mercari API Status:', res.statusCode);
            try {
                const parsed = JSON.parse(data);
                if (parsed.items) {
                    console.log(`✅ メルカリAPI取得成功! ${parsed.items.length} 件検出`);
                    console.log('先頭商品:', parsed.items[0].name, '¥' + parsed.items[0].price);
                } else {
                    console.log('API Response keys:', Object.keys(parsed));
                }
            } catch(e) {
                console.log('Response error:', e.message);
            }
        });
    });

    req.on('error', (e) => console.error('Mercari API Request Error:', e));
    req.write(postData);
    req.end();
}

testMercariApi('Nintendo Switch本体');
