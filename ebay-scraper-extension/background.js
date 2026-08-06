chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeEbay") {
        handleEbayScrape(request.keyword).then(sendResponse);
        return true; // Indicates async response
    }
});

async function handleEbayScrape(keyword) {
    return new Promise((resolve) => {
        // Adding &_udlo=1 (Price > 1) forces eBay to show the Search Results list and prevents it from redirecting
        // to the Product Catalog page (which drops the Sold filter and breaks the scraper).
        const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Sold=1&LH_Complete=1&LH_ItemCondition=3000&_sop=12&_udlo=1`;
        console.log("Opening background tab for eBay URL:", url);
        
        chrome.tabs.create({ url: url, active: true }, (tab) => {
            const tabId = tab.id;
            let finished = false;
            
            const checkReady = setInterval(() => {
                chrome.tabs.get(tabId, (updatedTab) => {
                    if (chrome.runtime.lastError) {
                        if (!finished) {
                            finished = true;
                            clearInterval(checkReady);
                            resolve({ success: false, error: "Tab closed prematurely" });
                        }
                        return;
                    }
                    
                    const isEbay = updatedTab.url && updatedTab.url.includes('ebay');
                    if (updatedTab.status === 'complete' && isEbay && !finished) {
                        finished = true;
                        clearInterval(checkReady);
                        
                        // Wait up to 8 seconds for actual data to appear
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: () => {
                                return new Promise((resolve) => {
                                    const hasPrices = () => {
                                        // Use regex to find prices in the visible text, bypassing any CSS class changes
                                        const text = document.body.innerText || "";
                                        const matches = text.match(/(?:JPY|US\s*\$|￥|\$)\s*[0-9]{1,3}(?:,[0-9]{3})*/ig);
                                        // Require at least 5 prices to ensure it's a real results page, not just a few sponsored items
                                        return matches && matches.length >= 5;
                                    };

                                    if (hasPrices()) {
                                        return resolve(document.documentElement.outerHTML);
                                    }
                                    
                                    const observer = new MutationObserver(() => {
                                        if (hasPrices()) {
                                            observer.disconnect();
                                            resolve(document.documentElement.outerHTML);
                                        }
                                    });
                                    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
                                    
                                    setTimeout(() => {
                                        observer.disconnect();
                                        resolve(document.documentElement.outerHTML);
                                    }, 8000); // Wait up to 8 seconds
                                });
                            }
                        }, (results) => {
                            // try { chrome.tabs.remove(tabId); } catch(e){} // Removed at user request to keep tab open
                            
                            if (chrome.runtime.lastError || !results || !results[0]) {
                                resolve({ success: false, error: "Script injection failed" });
                                return;
                            }
                            
                            resolve({ success: true, html: results[0].result, keyword: keyword });
                        });
                    }
                });
            }, 500);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (!finished) {
                    finished = true;
                    clearInterval(checkReady);
                    try { chrome.tabs.remove(tabId); } catch(e){}
                    resolve({ success: false, error: "eBay page load timeout" });
                }
            }, 10000);
        });
    });
}

