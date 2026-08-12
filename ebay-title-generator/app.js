function initApp() {
  // Elements
  const inputUrl = document.getElementById('input-url');
  const inputProductName = document.getElementById('input-product-name');
  const inputPrice = document.getElementById('input-price');
  const inputShipping = document.getElementById('input-shipping');

  const inputFee = document.getElementById('input-fee');
  const inputExchange = document.getElementById('input-exchange');
  const inputMargin = document.getElementById('input-margin');
  const inputExportShipping = document.getElementById('input-export-shipping');
  const inputProfit = document.getElementById('input-profit');
  const inputSellingPrice = document.getElementById('input-selling-price');

  const btnParseUrl = document.getElementById('btn-parse-url');
  const btnUpdateEbayPrice = document.getElementById('btn-update-ebay-price');
  const btnPresetNgk = document.getElementById('btn-preset-ngk');
  const btnGenerate = document.getElementById('btn-generate');
  const btnFetchAllImages = document.getElementById('btn-fetch-all-images');
  const btnOpenImageFolderInput = document.getElementById('btn-open-image-folder-input');

  const titlesContainer = document.getElementById('titles-container');
  const toast = document.getElementById('toast');

  // Utility number parser
  function parseNumber(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^0-9\.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  }

  let currentActiveRank = null;

  // Exact Mathematical Formula for eBay Selling Price, Fee, and Net Profit:
  // Net Profit = Selling Price * (Margin% / 100)
  // eBay Fee = Selling Price * 0.12
  // Selling Price = Total Cost / (1 - 0.12 - Margin% / 100)
  function calculatePricing() {
    if (!inputPrice || !inputSellingPrice || !inputFee) return;

    const rawPrice = inputPrice.value ? inputPrice.value.trim() : '';

    // If 仕入価格 (Purchase Price) is blank/empty, set ebayFee, profit, and sellingPrice to '-'
    if (!rawPrice) {
      inputFee.value = '-';
      if (inputProfit) inputProfit.value = '-';
      inputSellingPrice.value = '-';
      return;
    }

    const purchasePrice = parseNumber(rawPrice);
    const domesticShipping = parseNumber(inputShipping ? inputShipping.value : '0');
    const exportShipping = parseNumber(inputExportShipping ? inputExportShipping.value : '0');
    const marginPercent = parseNumber(inputMargin ? inputMargin.value : '0');
    const exchangeRate = parseNumber(inputExchange ? inputExchange.value : '0');

    const totalCost = purchasePrice + domesticShipping + exportShipping;

    if (totalCost <= 0) {
      inputFee.value = '-';
      if (inputProfit) inputProfit.value = '-';
      inputSellingPrice.value = '-';
      return;
    }

    // Mathematical formula for eBay listing price:
    // Selling Price = Total Cost / (1 - eBay Fee Rate (0.12) - Profit Margin Rate (M / 100))
    let denominator = 0.88 - (marginPercent / 100);
    if (denominator <= 0.01) denominator = 0.01;

    const sellingPriceJp = Math.round(totalCost / denominator);
    const ebayFeeJp = Math.round(sellingPriceJp * 0.12);
    const netProfitJp = sellingPriceJp - ebayFeeJp - totalCost;

    // Format eBay Fee (12%)
    inputFee.value = `￥${ebayFeeJp.toLocaleString('ja-JP')}`;

    // Format Net Profit (緑色の利益)
    if (inputProfit) {
      inputProfit.value = `￥${netProfitJp.toLocaleString('ja-JP')}`;
    }

    // Format Selling Price (売値) in JPY + ($USD) in parentheses
    if (exchangeRate > 0) {
      const sellingPriceUsd = (sellingPriceJp / exchangeRate).toFixed(2);
      inputSellingPrice.value = `￥${sellingPriceJp.toLocaleString('ja-JP')} ($${sellingPriceUsd})`;
    } else {
      inputSellingPrice.value = `￥${sellingPriceJp.toLocaleString('ja-JP')}`;
    }
  }

  // Load & Persist Exchange (為替), Margin (利益率), ExportShipping (発送料) across Server File & LocalStorage
  async function loadPersistedValues() {
    let ex = localStorage.getItem('ebay_helper_exchange') || '';
    let mg = localStorage.getItem('ebay_helper_margin') || '';
    let exp = localStorage.getItem('ebay_helper_export_shipping') || '';

    try {
      const res = await fetch('/api/user-settings');
      const serverData = await res.json();
      if (serverData) {
        if (serverData.exchange !== undefined && serverData.exchange !== '') ex = serverData.exchange;
        if (serverData.margin !== undefined && serverData.margin !== '') mg = serverData.margin;
        if (serverData.exportShipping !== undefined && serverData.exportShipping !== '') exp = serverData.exportShipping;
      }
    } catch(e) {}

    if (inputExchange && ex) inputExchange.value = ex;
    if (inputMargin && mg) inputMargin.value = mg;
    if (inputExportShipping && exp) inputExportShipping.value = exp;

    calculatePricing();
  }

  function savePersistedValues() {
    const ex = inputExchange ? inputExchange.value : '';
    const mg = inputMargin ? inputMargin.value : '';
    const exp = inputExportShipping ? inputExportShipping.value : '';

    localStorage.setItem('ebay_helper_exchange', ex);
    localStorage.setItem('ebay_helper_margin', mg);
    localStorage.setItem('ebay_helper_export_shipping', exp);

    // Persist to server user_settings.json
    fetch('/api/user-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange: ex, margin: mg, exportShipping: exp })
    }).catch(() => {});

    calculatePricing();
  }

  // Real-time calculation triggers on any pricing field input
  [inputPrice, inputShipping, inputExchange, inputMargin, inputExportShipping].forEach(el => {
    if (el) {
      el.addEventListener('input', () => {
        savePersistedValues();
        calculatePricing();
      });
      el.addEventListener('change', () => {
        savePersistedValues();
        calculatePricing();
      });
    }
  });

  // Enter key navigation sequence across Section 1 fields
  const fieldEnterSequence = [
    'input-price',
    'input-shipping',
    'input-exchange',
    'input-margin',
    'input-export-shipping',
    'input-desc-details'
  ];

  fieldEnterSequence.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (el && id !== 'input-desc-details') {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextId = fieldEnterSequence[idx + 1];
          if (nextId) {
            const nextEl = document.getElementById(nextId);
            if (nextEl) {
              nextEl.focus();
              if (typeof nextEl.select === 'function') {
                setTimeout(() => nextEl.select(), 10);
              }
            }
          }
        }
      });
    }
  });

  window.addEventListener('beforeunload', savePersistedValues);

  // Call loadPersistedValues on initialization
  loadPersistedValues();

  // Auto select all text when focusing/clicking input fields for instant overwrite
  const textInputs = document.querySelectorAll('input[type="text"], textarea');
  textInputs.forEach(input => {
    input.addEventListener('focus', function() {
      setTimeout(() => this.select(), 10);
    });
    input.addEventListener('click', function() {
      this.select();
    });
  });

  // 商管どん Sync Elements
  const shokandonTitle = document.getElementById('shokandon-title');
  const shokandonSku = document.getElementById('shokandon-sku');
  const btnCopyShokandon = document.getElementById('btn-copy-shokandon');

  const inputDescDetails = document.getElementById('input-desc-details');
  const descPreviewRendered = document.getElementById('desc-preview-rendered');
  const descJpExplanation = document.getElementById('desc-jp-explanation');
  const btnCopyDescHtml = document.getElementById('btn-copy-desc-html');
  const btnCopyDescText = document.getElementById('btn-copy-desc-text');

  let generatedDescHtml = '';
  let generatedDescText = '';

  // Open Local Images Folder Handler
  if (btnOpenImageFolderInput) {
    btnOpenImageFolderInput.addEventListener('click', (e) => {
      e.preventDefault();
      fetch('/api/open-images-folder', { method: 'POST' })
        .then(res => res.json())
        .then(data => showToast('📁 画像保存フォルダをWindowsで開きました！'))
        .catch(err => showToast('📁 画像保存フォルダを開きました'));
    });
  }

  // Fetch & Save ALL Images Handler
  if (btnFetchAllImages) {
    btnFetchAllImages.addEventListener('click', async () => {
      const url = inputUrl ? inputUrl.value.trim() : '';
      if (!url || !url.startsWith('http')) {
        showToast('商品URLを正しく入力してください');
        return;
      }

      const imgHeaderThumb = document.getElementById('img-header-thumb');
      const imageUrl = imgHeaderThumb ? imgHeaderThumb.src : '';

      btnFetchAllImages.disabled = true;
      btnFetchAllImages.innerHTML = '<span>⏳ 商品ページから全画像を取得＆保存中...</span>';
      showToast('⏳ 商品ページから全画像をダウンロードしています...');

      try {
        const title = inputDescDetails ? inputDescDetails.value.trim() : '';
        const resp = await fetch('/api/download-all-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, title, imageUrl })
        });
        const res = await resp.json();

        if (res.success) {
          showToast(`🎉 全 ${res.count}枚 の画像をデスクトップへ保存完了しました！`);
        } else {
          showToast(`❌ 画像取得エラー: ${res.error || '失敗しました'}`);
        }
      } catch (err) {
        showToast('❌ 画像保存中に通信エラーが発生しました。');
      } finally {
        btnFetchAllImages.disabled = false;
        btnFetchAllImages.innerHTML = '<span class="icon" style="font-size: 1.1rem;">📸</span> 商品URLの画像をすべて取得・デスクトップ保存する';
      }
    });
  }

  // Preset Handler (if present)
  if (btnPresetNgk) {
    btnPresetNgk.addEventListener('click', () => {
      if (inputUrl) inputUrl.value = 'https://www.amazon.co.jp/dp/B001RLZ94S/';
      if (inputProductName) inputProductName.value = '任天堂 Wii 本体セット ホワイト';
      if (inputDescDetails) inputDescDetails.value = '新品未開封・二輪車用純正スパークプラグ。高品質な日本製。即日発送。';
      
      parseUrlAndGenerate();
    });
  }

  function clearAllFormFields() {
    if (inputProductName) inputProductName.value = '';
    if (inputPrice) inputPrice.value = '';
    if (inputShipping) inputShipping.value = '';
    // Note: inputExchange, inputMargin, inputExportShipping are PERSISTED across sessions & URLs, so they are not reset here!
    if (inputFee) inputFee.value = '-';
    if (inputProfit) inputProfit.value = '-';
    if (inputSellingPrice) inputSellingPrice.value = '-';

    const sabDisplay = document.getElementById('sab-rank-display');
    const sabContent = document.getElementById('sab-rank-content');
    const sabMatchedName = document.getElementById('sab-rank-matched-name');
    if (sabContent) sabContent.innerHTML = '';
    if (sabDisplay) sabDisplay.style.display = 'none';
    if (sabMatchedName) sabMatchedName.textContent = '';

    const imgHeaderThumb = document.getElementById('img-header-thumb');
    const imgPlaceholderText = document.getElementById('img-placeholder-text');
    if (imgHeaderThumb) {
      imgHeaderThumb.src = '';
      imgHeaderThumb.style.display = 'none';
    }
    if (imgPlaceholderText) {
      imgPlaceholderText.style.display = 'flex';
    }

    if (inputDescDetails) inputDescDetails.value = '';
    if (inputManualEnTitle) inputManualEnTitle.value = '';
    if (manualEnCharCount) manualEnCharCount.textContent = '0';
  }

  function formatSellPriceDisplay(usdRaw, rate) {
    if (!usdRaw || usdRaw === '-') return '-';
    
    // Extract numeric USD value
    const usdNum = parseFloat(String(usdRaw).replace(/[^0-9.]/g, ''));
    if (isNaN(usdNum) || usdNum <= 0) return '-';

    // Format USD string
    const usdFormatted = '$' + (Number.isInteger(usdNum) ? usdNum.toString() : usdNum.toFixed(2));

    if (!isNaN(rate) && rate > 0) {
      const jpyVal = Math.round(usdNum * rate);
      const jpyFormatted = '￥' + jpyVal.toLocaleString('ja-JP');
      return `${jpyFormatted} (${usdFormatted})`;
    }

    return usdFormatted;
  }

  async function updateProductDbSellPrices(queryText, imageUrl) {
    const sabDisplay = document.getElementById('sab-rank-display');
    const sabContent = document.getElementById('sab-rank-content');
    const sabMatchedName = document.getElementById('sab-rank-matched-name');

    if (!sabDisplay || !sabContent || !sabMatchedName) return;

    if (queryText && queryText.type === 'click') queryText = null;

    let searchProductName = '';
    // Priority 1: User's explicit input box value (e.g., 'PCH-2000')
    if (inputProductName && inputProductName.value.trim()) {
        searchProductName = inputProductName.value.trim();
    } 
    // Priority 2: Passed query text (e.g., from auto-analyze full title)
    else if (typeof queryText === 'string' && queryText.trim()) {
        searchProductName = queryText.trim();
    } 
    // Priority 3: Fallback to description details
    else if (inputDescDetails && inputDescDetails.value.trim()) {
        searchProductName = inputDescDetails.value.trim().substring(0, 50);
    }

    if (!searchProductName) return;
    sabMatchedName.textContent = "検索中...";
    sabContent.innerHTML = '<div style="color:#cbd5e1;text-align:center;padding:1rem;">eBayを検索中... (拡張機能が動作しています)</div>';
    sabDisplay.style.display = 'block';

    const rate = inputExchange ? parseFloat(inputExchange.value.replace(/[^0-9.]/g, '')) : NaN;

    // Send custom event to extension
    window.dispatchEvent(new CustomEvent("RequestEbayScrape", {
        detail: { keyword: searchProductName }
    }));

    // Add a fallback timeout in case the extension is disabled or fails to respond
    window._ebayScrapeTimeout = setTimeout(() => {
        const sabContent = document.getElementById('sab-rank-content');
        if (sabContent && sabContent.innerHTML.includes('eBayを検索中')) {
            sabContent.innerHTML = `
                <div style="color:#ef4444;text-align:center;padding:1rem;">
                    タイムアウトしました。<br>
                    拡張機能が正しく動作していないか、ページがリロードされていません。<br>
                    キーボードの「F12」キーを押して開発者ツールを開き、Consoleタブにエラーが出ていないか確認してください。
                </div>`;
        }
    }, 15000);
  }

  window.addEventListener("EbayScrapeResult", (event) => {
    if (window._ebayScrapeTimeout) {
        clearTimeout(window._ebayScrapeTimeout);
    }
    const data = event.detail;
    const sabDisplay = document.getElementById('sab-rank-display');
    const sabContent = document.getElementById('sab-rank-content');
    if (!sabContent) return;

    if (data && data.success && data.prices) {
        const sabMatchedName = document.getElementById('sab-rank-matched-name');
        if (sabMatchedName) {
            sabMatchedName.textContent = data.keyword || '一般商品';
        }

        const rate = inputExchange ? parseFloat(inputExchange.value.replace(/[^0-9.]/g, '')) : NaN;
        
        const getFormattedRow = (rank, usd, desc, label) => {
            if (isNaN(usd) || usd <= 0) return '';
            const jpy = (!isNaN(rate) && rate > 0) ? Math.round(usd * rate) : 0;
            return `
              <div>
                <span style="font-weight: 700; color: #fff;">■ ${rank}</span> <span style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-left: 0.5rem;">￥${jpy > 0 ? jpy.toLocaleString('ja-JP') : '0'}</span> <span style="color: #94a3b8; font-size: 0.95rem;">($${usd})</span>
                <ul style="margin: 0.3rem 0 0 1.2rem; padding: 0; color: #94a3b8; font-size: 0.85rem;">
                  <li>${label}</li>
                  <li>・ ${desc}</li>
                </ul>
              </div>
            `;
        };

        const sDesc = "美品で傷が無く、箱・付属品が完備しているセット。";
        const aDesc = "本体・ACアダプター・AVケーブルの必須ケーブル類が揃っている良品セット。";
        const bDesc = "本体と必要最低限のケーブルのみの出品、または外観に傷やスレが多い品。";

        let htmlContent = '';
        if (data.prices.s) htmlContent += getFormattedRow('Sランク', data.prices.s, sDesc, '(Mint / 極美品・フルセット・箱付・コントローラー付)');
        if (data.prices.a) htmlContent += getFormattedRow('Aランク', data.prices.a, aDesc, '(Good / 良品・動作確認済・必須ケーブル付属)');
        if (data.prices.b) htmlContent += getFormattedRow('Bランク', data.prices.b, bDesc, '(Fair / 並品・本体のメイン / 外装に使用感・スレ)');

        sabContent.innerHTML = htmlContent;
    } else {
        sabContent.innerHTML = `<div style="color:#ef4444;text-align:center;padding:1rem;">eBay価格が取得できませんでした: ${data.error || '不明なエラー'}</div>`;
    }
  });

  // Hook up the manual update button
  if (btnUpdateEbayPrice) {
    btnUpdateEbayPrice.addEventListener('click', updateProductDbSellPrices);
  }

  // (calculateRankProfit removed)

  // URL Parser & Instant Generation Logic
  if (btnParseUrl) {
    btnParseUrl.addEventListener('click', parseUrlAndGenerate);
  }

  if (inputUrl) {
    inputUrl.addEventListener('paste', () => {
      setTimeout(() => {
        if (inputUrl.value.trim()) {
          parseUrlAndGenerate();
        }
      }, 150);
    });
    inputUrl.addEventListener('change', () => {
      if (inputUrl.value.trim()) {
        parseUrlAndGenerate();
      }
    });
  }

  async function parseUrlAndGenerate() {
    let url = inputUrl ? inputUrl.value.trim() : '';

    // Fix https://file:/// or http://file:/// pasted by mistake
    if (url.startsWith('https://file://') || url.startsWith('http://file://')) {
      url = url.replace(/^https?:\/\//i, '');
      if (inputUrl) inputUrl.value = url;
    }

    if (url && !url.match(/^(https?|file):\/\//i) && !url.match(/^[a-zA-Z]:[\\\/]/)) {
      url = 'https://' + url;
      if (inputUrl) inputUrl.value = url;
    }

    // Clear product-specific form fields (retaining persisted 為替, 利益率, 発送料)
    clearAllFormFields();

    // Show loading overlay on image box immediately
    const imgLoadingOverlay = document.getElementById('img-loading-overlay');
    if (imgLoadingOverlay) imgLoadingOverlay.style.display = 'flex';

    if (btnParseUrl) {
      btnParseUrl.disabled = true;
      btnParseUrl.innerHTML = '<span>⏳ Webページを解析中...</span>';
    }

    if (url && (url.startsWith('http') || url.startsWith('file') || url.match(/^[a-zA-Z]:[\\\/]/))) {
      showToast('⏳ URLから実際のWebページ情報を自動解析中...');

      try {
        console.log('[parseUrlAndGenerate] Fetching URL:', url);
        const resp = await fetch('/api/parse-url-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const meta = await resp.json();
        console.log('[parseUrlAndGenerate] Received Meta:', meta);

        if (meta.success) {
          const parsedMpn = meta.mpn || meta.title || meta.details || '';
          if (inputProductName) inputProductName.value = parsedMpn;
          if (inputPrice) inputPrice.value = meta.price || '';
          if (inputShipping) inputShipping.value = meta.shipping || '￥0';
          
          const fullProductContent = meta.details || meta.title || meta.mpn || '';

          if (meta.details) {
            const cleanedDetails = meta.details
              .replace(/^Amazon(?:\.co\.jp|\.com)?\s*[:|-]\s*/i, '')
              .replace(/\s*:\s*[^:]+$/i, '')
              .trim();
            if (inputDescDetails) inputDescDetails.value = cleanedDetails;
            if (inputManualEnTitle) inputManualEnTitle.value = '';
            updateManualEnCharCounter(0);
            renderDetailsWordChips(cleanedDetails);
          }

          calculatePricing();

          // Update Product Image in Section 1 Header
          const imgHeaderThumb = document.getElementById('img-header-thumb');
          const imgPlaceholderText = document.getElementById('img-placeholder-text');

          if (meta.imageUrl) {
            if (imgHeaderThumb) {
              imgHeaderThumb.src = meta.imageUrl;
              imgHeaderThumb.style.display = 'block';
            }
            if (imgPlaceholderText) {
              imgPlaceholderText.style.display = 'none';
            }
          } else {
            if (imgHeaderThumb) {
              imgHeaderThumb.src = '';
              imgHeaderThumb.style.display = 'none';
            }
            if (imgPlaceholderText) {
              imgPlaceholderText.style.display = 'flex';
            }
          }

          // Automatically Calculate Selling Price, eBay Fee & Profit based on parsed price + shipping
          calculatePricing();

          showToast('✅ Webページから実物商品情報・価格・画像を自動抽出＆売値・利益計算完了！');
        }
      } catch (err) {
        console.warn('URL Meta parse failed:', err);
      } finally {
        if (imgLoadingOverlay) imgLoadingOverlay.style.display = 'none';
        if (btnParseUrl) {
          btnParseUrl.disabled = false;
          btnParseUrl.innerHTML = '✨ 自動解析 ＆ タイトル・説明を生成';
        }
      }
    } else {
      if (imgLoadingOverlay) imgLoadingOverlay.style.display = 'none';
      if (btnParseUrl) {
        btnParseUrl.disabled = false;
        btnParseUrl.innerHTML = '✨ 自動解析 ＆ タイトル・説明を生成';
      }
    }

    generateTitles();
  }

  // Automatically clear old inputs and parse when a new URL is pasted
  if (inputUrl) {
    inputUrl.addEventListener('paste', () => {
      setTimeout(() => {
        parseUrlAndGenerate();
      }, 50);
    });

    inputUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        parseUrlAndGenerate();
      }
    });
  }

  const btnTranslateCopyEn = document.getElementById('btn-translate-copy-en');
  const inputManualEnTitle = document.getElementById('input-manual-en-title');
  const manualEnCharCount = document.getElementById('manual-en-char-count');

  function updateManualEnCharCounter(count) {
    if (!manualEnCharCount) return;
    manualEnCharCount.textContent = count;
    const parentContainer = manualEnCharCount.closest('.char-counter-large');
    if (parentContainer) {
      if (count > 80) {
        parentContainer.style.background = '#ef4444';
        parentContainer.style.color = '#ffffff';
        parentContainer.style.border = '1px solid #dc2626';
      } else {
        parentContainer.style.background = '#0f172a';
        parentContainer.style.color = '#38bdf8';
        parentContainer.style.border = '1px solid rgba(56, 189, 248, 0.4)';
      }
    }
  }

  async function translateAndFormatManualTitle() {
    const rawVal = inputDescDetails ? inputDescDetails.value.trim() : '';

    if (!rawVal) {
      updateManualEnCharCounter(0);
      if (inputManualEnTitle) inputManualEnTitle.value = '';
      return '';
    }

    try {
      const resp = await fetch('/api/translate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawVal })
      });
      const data = await resp.json();
      
      let translated = (data && data.success && data.translatedText) ? data.translatedText : rawVal;

      if (inputManualEnTitle) {
        inputManualEnTitle.value = translated;
      }

      updateManualEnCharCounter(translated.length);

      if (shokandonTitle) {
        shokandonTitle.value = translated;
      }

      return translated;
    } catch(e) {
      console.warn('Translate API error:', e);
      return '';
    }
  }

  if (inputDescDetails) {
    inputDescDetails.addEventListener('input', () => {
      if (!inputDescDetails.value.trim()) {
        if (inputManualEnTitle) inputManualEnTitle.value = '';
        if (manualEnCharCount) manualEnCharCount.textContent = '0';
      }
      generateTitles();
    });
  }

  if (btnTranslateCopyEn) {
    btnTranslateCopyEn.addEventListener('click', async () => {
      showToast('⏳ 英文へ自動翻訳中...');
      const enTitle = await translateAndFormatManualTitle();
      if (!enTitle) {
        showToast('手動タイトルを入力または単語タグをクリックしてください');
        return;
      }

      copyToClipboard(enTitle);
      showToast(`🔤 英文タイトル「${enTitle.substring(0, 28)}...」を英訳＆コピーしました！`);
    });
  }

  function renderDetailsWordChips(text) {
    const wrapper = document.getElementById('details-chips-wrapper');
    if (!wrapper) return;

    if (!text || !text.trim()) {
      wrapper.innerHTML = '<span style="font-size: 0.78rem; color: #64748b; font-style: italic;">URLを解析するとここに単語タグが自動生成され、クリックしてタイトルを直感作成できます。</span>';
      return;
    }

    const cleanText = text
      .replace(/^Amazon(?:\.co\.jp|\.com)?\s*[:|-]\s*/i, '')
      .replace(/\s*:\s*[^:]+$/i, '')
      .trim();

    let words = cleanText.split(/[\s,]+/).filter(w => {
      if (!w || w.length === 0 || w === '|') return false;
      const lower = w.toLowerCase();
      if (lower.includes('yahoo') || lower.includes('ヤフオク') || lower.includes('amazon') || w === '-') return false;
      return true;
    });
    // Always place '|' at the very first position (top-left) of the word tags!
    words.unshift('|');

    wrapper.innerHTML = '';

    words.forEach(word => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      if (word === '|') {
        chip.style.cssText = 'background: rgba(14, 165, 233, 0.25); color: #38bdf8; border: 1.5px solid #38bdf8; font-size: 0.95rem; font-weight: 800; padding: 0.35rem 0.85rem; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; margin-right: 6px; margin-bottom: 6px; display: inline-block; max-width: none; white-space: nowrap; text-overflow: clip; overflow: visible;';
      } else {
        chip.style.cssText = 'background: rgba(15, 23, 42, 0.9); color: #38bdf8; border: 1px solid #0284c7; font-size: 0.88rem; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; margin-right: 6px; margin-bottom: 6px; display: inline-block; max-width: none; white-space: nowrap; text-overflow: clip; overflow: visible;';
      }
      chip.textContent = word;

      chip.addEventListener('click', () => {
        if (inputDescDetails) {
          const currentVal = inputDescDetails.value.trim();
          if (!currentVal) {
            inputDescDetails.value = word;
          } else {
            inputDescDetails.value = `${currentVal} ${word}`;
          }
          generateTitles();
          showToast(`「${word}」をタイトルBOXに追加しました！`);
        }
      });

      chip.addEventListener('mouseenter', () => {
        chip.style.background = '#0284c7';
        chip.style.color = '#ffffff';
      });
      chip.addEventListener('mouseleave', () => {
        chip.style.background = word === '|' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.9)';
        chip.style.color = '#38bdf8';
      });

      wrapper.appendChild(chip);
    });
  }

  // Main Generator Handler (if element exists)
  if (btnGenerate) {
    btnGenerate.addEventListener('click', generateTitles);
  }

  // Real-time auto update as user types in any input field
  [inputProductName, inputPrice, inputShipping, inputDescDetails].forEach(el => {
    if (el) {
      el.addEventListener('input', () => {
        generateTitles();
        calculatePricing();
      });
    }
  });

  if (inputManualEnTitle) {
    inputManualEnTitle.addEventListener('input', () => {
      const currentVal = inputManualEnTitle.value;
      updateManualEnCharCounter(currentVal.length);
      if (shokandonTitle) {
        shokandonTitle.value = currentVal;
      }
    });
  }

  function generateTitles() {
    const mpn = inputProductName ? inputProductName.value.trim().toUpperCase() : '';
    const extraDetails = inputDescDetails ? inputDescDetails.value.trim() : '';
    const mpnVal = mpn || '';

    // Candidates Template Generation (Clean Product & Specs Only, No Fluff Words)
    const candidates = [
      {
        tag: '🔥 実用モデル名重視型 (Clean Product & Model Focus)',
        title: `${mpnVal}`.replace(/\s+/g, ' ').trim(),
        jp: `${mpnVal} 商品モデル名構成`.replace(/\s+/g, ' ').trim()
      },
      {
        tag: '✨ 仕様区分型 (Specs & Variant Focus)',
        title: `${mpnVal}`.replace(/\s+/g, ' ').trim(),
        jp: `${mpnVal} 仕様区分構成`.replace(/\s+/g, ' ').trim()
      }
    ];

    // Truncate to 80 chars if any exceeds
    candidates.forEach(c => {
      if (c.title.length > 80) {
        c.title = c.title.substring(0, 80).trim();
      }
    });

    renderTitleCards(candidates);

    // Auto set default to 商管どん sync fields
    if (shokandonTitle && candidates[0]) {
      shokandonTitle.value = candidates[0].title;
    }
    if (shokandonSku) {
      shokandonSku.value = mpnVal || 'ITEM';
    }
  }



  function renderTitleCards(candidates) {
    if (!titlesContainer) return;
    titlesContainer.innerHTML = '';

    candidates.forEach((item) => {
      const charLen = item.title.length;
      let badgeClass = 'ok';
      if (charLen > 75 && charLen <= 80) badgeClass = 'ok';
      else if (charLen > 80) badgeClass = 'over';

      const cardHtml = document.createElement('div');
      cardHtml.className = 'title-item-card';
      cardHtml.innerHTML = `
        <div class="title-item-header">
          <span class="title-tag">${escapeHtml(item.tag)}</span>
          <span class="badge badge-char ${badgeClass}">${charLen} / 80文字</span>
        </div>
        <div class="title-text-box">${escapeHtml(item.title)}</div>
        <div class="title-actions">
          <div class="jp-explanation">💡 ${escapeHtml(item.jp)}</div>
          <button type="button" class="btn-copy-small" data-title="${escapeHtml(item.title)}">
            <span>📋</span> コピー
          </button>
        </div>
      `;

      titlesContainer.appendChild(cardHtml);
    });

    document.querySelectorAll('.btn-copy-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const textToCopy = e.currentTarget.getAttribute('data-title');
        copyToClipboard(textToCopy);
        if (shokandonTitle) shokandonTitle.value = textToCopy;
      });
    });
  }

  // 商管どん Sync copy
  if (btnCopyShokandon) {
    btnCopyShokandon.addEventListener('click', () => {
      const title = shokandonTitle ? shokandonTitle.value : '';
      const sku = shokandonSku ? shokandonSku.value : '';
      if (!title) {
        showToast('コピー対象のタイトルがありません');
        return;
      }

      const combinedText = `${sku}\t${title}`;
      copyToClipboard(combinedText);
      showToast('商管どん用データ（SKU+タイトル）をクリップボードにコピーしました！');
    });
  }

  // Gemini Prompt Generator & Copy Handler
  const btnCopyGeminiPrompt = document.getElementById('btn-copy-gemini-prompt');
  const btnOpenNotebooklm = document.getElementById('btn-open-notebooklm');
  const inputGeminiCustomNotes = document.getElementById('input-gemini-custom-notes');

  function buildGeminiPromptText() {
    const productName = inputProductName ? inputProductName.value.trim() : '';
    const customNotes = inputGeminiCustomNotes ? inputGeminiCustomNotes.value.trim() : '';
    const urlVal = inputUrl ? inputUrl.value.trim() : '';

    let promptLines = [
      'この商品のタイトルと説明を書いてください。',
      '',
      '【出力指定】',
      '1. eBay用タイトルは76文字以内の英語で作成してください（eBay出品ページ貼り付け用）。',
      '2. 作成した英文タイトルの「直訳日本語」も併記してください。',
      '3. 海外バイヤー向けにわかりやすく丁寧な商品説明文を作成してください。'
    ];

    if (customNotes) {
      promptLines.push(`4. 追加で考慮する事項: ${customNotes}`);
    }

    if (productName || urlVal) {
      promptLines.push('');
      promptLines.push('【参照情報】');
      if (productName) promptLines.push(`・商品名 / 製品名: ${productName}`);
      if (urlVal) promptLines.push(`・参照URL: ${urlVal}`);
    }

    return promptLines.join('\n');
  }

  if (btnCopyGeminiPrompt) {
    btnCopyGeminiPrompt.addEventListener('click', () => {
      const promptText = buildGeminiPromptText();
      copyToClipboard(promptText);
      window.open('https://gemini.google.com/', '_blank');
      showToast('✨ 指示文をコピーしGeminiを別タブで自動起動しました！【Ctrl + V】で貼り付けてください。');
    });
  }

  if (btnOpenNotebooklm) {
    btnOpenNotebooklm.addEventListener('click', () => {
      const promptText = buildGeminiPromptText();
      copyToClipboard(promptText);
      window.open('https://notebooklm.google.com/', '_blank');
      showToast('📓 指示文をコピーしNotebookLMを自動起動しました！【Ctrl + V】で貼り付けてください。');
    });
  }

  function copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`コピー完了: "${text.substring(0, 25)}..."`);
      }).catch(() => {
        fallbackCopyText(text);
      });
    } else {
      fallbackCopyText(text);
    }
  }

  function fallbackCopyText(text) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast(`コピー完了: "${text.substring(0, 25)}..."`);
    } catch (err) {
      showToast('コピーに失敗しました');
    }
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Calculated （送料自動計算用） Unit Converter Logic (Kg -> lbs/oz, cm -> inches)
  function updateUnitConversions() {
    const kgInput = document.getElementById('calc-weight-kg');
    const lbsOutput = document.getElementById('calc-weight-lbs');
    const ozOutput = document.getElementById('calc-weight-oz');

    if (kgInput && lbsOutput && ozOutput) {
      const kgVal = parseFloat(kgInput.value);
      if (!isNaN(kgVal) && kgVal > 0) {
        const totalLbs = kgVal * 2.20462262;
        const lbs = Math.floor(totalLbs);
        const oz = parseFloat(((totalLbs - lbs) * 16).toFixed(1));
        lbsOutput.value = lbs;
        ozOutput.value = oz;
      } else {
        lbsOutput.value = '';
        ozOutput.value = '';
      }
    }

    const convertCmToIn = (cmId, inId) => {
      const cmInput = document.getElementById(cmId);
      const inOutput = document.getElementById(inId);
      if (cmInput && inOutput) {
        const cmVal = parseFloat(cmInput.value);
        if (!isNaN(cmVal) && cmVal > 0) {
          inOutput.value = parseFloat((cmVal * 0.393701).toFixed(1));
        } else {
          inOutput.value = '';
        }
      }
    };

    convertCmToIn('calc-dim-l-cm', 'calc-dim-l-in');
    convertCmToIn('calc-dim-w-cm', 'calc-dim-w-in');
    convertCmToIn('calc-dim-h-cm', 'calc-dim-h-in');
  }

  ['calc-weight-kg', 'calc-dim-l-cm', 'calc-dim-w-cm', 'calc-dim-h-cm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateUnitConversions);
    }
  });

  // Calculated （送料自動計算用） Enter Key Focus Navigation
  const calcEnterSequence = [
    'calc-weight-kg',
    'calc-dim-l-cm',
    'calc-dim-w-cm',
    'calc-dim-h-cm'
  ];

  calcEnterSequence.forEach((currentId, index) => {
    const el = document.getElementById(currentId);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextId = calcEnterSequence[index + 1];
          if (nextId) {
            const nextEl = document.getElementById(nextId);
            if (nextEl) {
              nextEl.focus();
              if (typeof nextEl.select === 'function') {
                nextEl.select();
              }
            }
          }
        }
      });
    }
  });

  // 商品sell価DB (S, A, B) Enter Key Focus Navigation
  const sellPriceDbSequence = [
    'input-sell-price-s',
    'input-sell-price-a',
    'input-sell-price-b',
    'input-price'
  ];

  sellPriceDbSequence.forEach((currentId, index) => {
    const el = document.getElementById(currentId);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextId = sellPriceDbSequence[index + 1];
          if (nextId) {
            const nextEl = document.getElementById(nextId);
            if (nextEl) {
              nextEl.focus();
              if (typeof nextEl.select === 'function') {
                nextEl.select();
              }
            }
          }
        }
      });
    }
  });

  // Initial load: If an inputUrl has a value, parse it
  if (inputUrl && inputUrl.value && inputUrl.value.startsWith('http')) {
    parseUrlAndGenerate();
  } else {
    generateTitles();
  }
}

// Ensure execution regardless of DOMReady timing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
