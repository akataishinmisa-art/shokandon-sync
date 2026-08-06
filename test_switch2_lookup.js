(async () => {
    try {
        console.log('Testing lookup-product-db for: Nintendo Switch 2 本体 日本国内専用');
        const resp = await fetch('http://localhost:3000/api/lookup-product-db?mpn=' + encodeURIComponent('Nintendo Switch 2 本体 日本国内専用'));
        const data = await resp.json();
        console.log('Result:', JSON.stringify(data, null, 2));

        console.log('\nTesting lookup-product-db for: Nintendo Switch 従来型本体');
        const resp2 = await fetch('http://localhost:3000/api/lookup-product-db?mpn=' + encodeURIComponent('Nintendo Switch 従来型本体'));
        const data2 = await resp2.json();
        console.log('Result:', JSON.stringify(data2, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
