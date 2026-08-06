// content.js - Injected into localhost:3000 / localhost:8085

// Listen for custom event from the web app
window.addEventListener("RequestEbayScrape", (event) => {
    const keyword = event.detail.keyword;
    console.log("[Ebay Scraper Extension] Received scrape request for:", keyword);
    
    // Send message to background script
    chrome.runtime.sendMessage({ action: "scrapeEbay", keyword: keyword }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("[Ebay Scraper Extension] Runtime Error:", chrome.runtime.lastError);
            window.dispatchEvent(new CustomEvent("EbayScrapeResult", {
                detail: { success: false, error: chrome.runtime.lastError.message }
            }));
            return;
        }
        
        if (!response || !response.success || !response.html) {
            window.dispatchEvent(new CustomEvent("EbayScrapeResult", {
                detail: response || { success: false, error: "Unknown error from background script" }
            }));
            return;
        }
        
        // Parse HTML using DOMParser in the content script
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.html, 'text/html');
        
        let prices = [];

        // Primary Method: Target main search results container (#srp-river-results) specifically
        const mainContainer = doc.querySelector('#srp-river-results') || doc.querySelector('.srp-river-results') || doc;
        const itemElements = mainContainer.querySelectorAll('li.s-item, div.s-item');

        itemElements.forEach(item => {
            // 1. Ignore template element (.s-item--hansel)
            if (item.classList.contains('s-item--hansel')) return;

            // 2. Ignore Sponsored / Ad / Promoted listings
            const itemText = item.textContent || '';
            if (/sponsored|スポンサー|promoted|advertisement/i.test(itemText)) return;

            // 3. Find price element within this specific search item
            const priceEl = item.querySelector('.s-item__price');
            if (!priceEl) return;

            const text = priceEl.textContent || '';
            
            // Extract numeric price
            const match = text.match(/(?:JPY|US\s*\$|￥|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i) || text.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
            if (!match) return;

            const priceStr = match[1].replace(/,/g, '');
            let price = parseFloat(priceStr);

            if (!isNaN(price) && price > 10 && price < 1000000) {
                if (text.includes('JPY') || text.includes('￥') || text.includes('円')) {
                    prices.push(price / 150.0);
                } else {
                    prices.push(price);
                }
            }
        });
        
        // Fallback Method: Global regex search ONLY if main container item parsing yielded fewer than 3 prices
        if (prices.length < 3) {
            console.log("Fewer than 3 prices found via .s-item, trying fallback parsing...");
            const allPriceEls = doc.querySelectorAll('.s-item__price');
            allPriceEls.forEach(el => {
                const parent = el.closest('.s-item');
                if (parent) {
                    if (parent.classList.contains('s-item--hansel')) return;
                    if (/sponsored|スポンサー|promoted/i.test(parent.textContent || '')) return;
                }

                const text = el.textContent || '';
                const match = text.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
                if (match) {
                    const priceStr = match[1].replace(/,/g, '');
                    let price = parseFloat(priceStr);
                    if (!isNaN(price) && price > 10 && price < 1000000) {
                        if (text.includes('JPY') || text.includes('￥') || text.includes('円')) {
                            price = price / 150.0;
                        }
                        prices.push(price);
                    }
                }
            });
        }
        
        if (prices.length === 0) {
            console.error("No prices found in HTML. This means eBay returned 0 results for the keyword.");
            window.dispatchEvent(new CustomEvent("EbayScrapeResult", {
                detail: { success: false, error: "eBayで該当する商品が見つかりません。検索キーワードを英語（例: PCH-2000, 3DS LL）に修正してください。" }
            }));
            return;
        }
        
        // Calculate S, A, B tiers
        prices.sort((a, b) => a - b);
        let validPrices = prices;
        if (prices.length >= 5) {
            const dropCount = Math.floor(prices.length * 0.05);
            validPrices = prices.slice(dropCount, prices.length - dropCount);
        }
        if (validPrices.length === 0) validPrices = prices;
        
        const getPercentile = (arr, p) => arr[Math.floor((arr.length - 1) * p)];
        const b = getPercentile(validPrices, 0.25);
        const a = getPercentile(validPrices, 0.50);
        const s = getPercentile(validPrices, 0.75);
        
        window.dispatchEvent(new CustomEvent("EbayScrapeResult", {
            detail: { success: true, prices: { s, a, b }, keyword: response.keyword }
        }));
    });
});

console.log("[Ebay Scraper Extension] Content script loaded. Listening for RequestEbayScrape events.");
