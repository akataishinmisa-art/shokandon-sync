const https = require('https');

function lookupProductDbSellPrices(targetMpn) {
    return new Promise(resolve => {
        if (!targetMpn || !targetMpn.trim()) {
            return resolve({ s: '-', a: '-', b: '-', found: false });
        }
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent('商品DB');
        https.get(sheetUrl, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const lines = data.split(/\r?\n/);
                let resObj = { s: '-', a: '-', b: '-', found: false };
                const cleanTarget = targetMpn.trim().toUpperCase();

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue;

                    // Match CSV fields
                    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
                    if (cols.length >= 6) {
                        const mpn = cols[1] ? cols[1].trim().toUpperCase() : '';
                        const grade = cols[2] ? cols[2].trim() : '';
                        const sellUsd = cols[5] ? cols[5].trim() : '';

                        if (mpn === cleanTarget) {
                            resObj.found = true;
                            const formattedUsd = sellUsd ? (sellUsd.startsWith('$') ? sellUsd : '$' + sellUsd) : '-';
                            if (grade === 'Ｓ' || grade === 'S') resObj.s = formattedUsd;
                            if (grade === 'Ａ' || grade === 'A') resObj.a = formattedUsd;
                            if (grade === 'Ｂ' || grade === 'B') resObj.b = formattedUsd;
                        }
                    }
                }
                resolve(resObj);
            });
        }).on('error', err => {
            console.error('HTTP Error:', err.message);
            resolve({ s: '-', a: '-', b: '-', found: false });
        });
    });
}

(async () => {
    console.log('Testing PCH-2000:', await lookupProductDbSellPrices('PCH-2000'));
    console.log('Testing DMC-FX90:', await lookupProductDbSellPrices('DMC-FX90'));
    console.log('Testing DMC-FX77 (Unknown):', await lookupProductDbSellPrices('DMC-FX77'));
    console.log('Testing Empty MPN:', await lookupProductDbSellPrices(''));
})();
