const https = require('https');

function testRakumaParse() {
    https.get('https://item.fril.jp/22d4c7937f576d2d652ad56a192d6d2e', res => {
        let rawHtml = '';
        res.on('data', chunk => rawHtml += chunk);
        res.on('end', () => {
            let description = '';
            const ogDescMatch = rawHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                                rawHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
            if (ogDescMatch && ogDescMatch[1]) {
                description = ogDescMatch[1].replace(/<[^>]+>/g, '').trim();
            }

            const title = "ps vita psvita 未使用 新品 アクアブルー aqua Blu";
            const fullSearchText = (title + ' ' + description).replace(/[Ａ-Ｚａ-ｚ０-９－]/g, s => {
                if (s === '－') return '-';
                return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
            });

            console.log("Full Search Text:", fullSearchText);

            let mpn = '';
            const cameraBodyMatch = fullSearchText.match(/(Nikon\s*1\s*[J|V]\d?|J5|J4|J3|J2|J1|V3|V2|V1|EOS\s*Kiss\s*[X\d]+|EOS\s*M\d*|ILCE-\d+|NEX-[A-Z0-9]+|A6\d{3}|PCH[-_]?\d{4}|PSP[-_]?\d{4}|DMC-[A-Z0-9]+|EX-[A-Z0-9]+)/i);
            if (cameraBodyMatch) {
                mpn = cameraBodyMatch[1].toUpperCase().replace('_', '-');
                if (!mpn.includes('-') && mpn.match(/^(PCH|PSP)(\d{4})$/)) {
                    mpn = mpn.replace(/^(PCH|PSP)(\d{4})$/, '$1-$2');
                }
            }
            console.log("RESULTING MPN:", mpn);
        });
    });
}

testRakumaParse();
