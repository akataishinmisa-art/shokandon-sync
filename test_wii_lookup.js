(async () => {
    try {
        console.log('Testing lookup-product-db for: Nintendo Wii 本体セット');
        const resp = await fetch('http://localhost:3000/api/lookup-product-db?mpn=' + encodeURIComponent('Nintendo Wii 本体セット'));
        const data = await resp.json();
        console.log('Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
