// State
window.openCategories = window.openCategories || new Set(["📷 デジタルカメラ", "🎮 ゲーム機本体", "⌚ 時計・ブランド", "📁 その他・未分類"]);
let currentUsdJpyRate = 155.0;
let currentRate = 155.0; // 互換エイリアス
let soundAlertEnabled = true;
let targetItems = [];
let detections = [];

if (new URLSearchParams(window.location.search).get('embed') === '1') {
  document.body.classList.add('embed-mode');
}

// 🌸 SAKURA Sync 親ダッシュボードからのカテゴリフィルタ ＆ 特定商品詳細画面の起動連動
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FILTER_CATEGORY') {
    const cat = event.data.category;
    const selectEl = document.getElementById('filter-target-category');
    if (selectEl) {
      selectEl.value = (cat === 'all') ? 'all' : cat;
      selectEl.dispatchEvent(new Event('change'));
    }
  } else if (event.data && event.data.type === 'SELECT_TARGET_ITEM') {
    const targetId = event.data.targetId;
    const item = targetItems.find(t => String(t.id) === String(targetId));
    if (item) {
      openTargetDetail(item);
    } else {
      fetch(`/api/targets/${targetId}`)
        .then(res => res.json())
        .then(fetchedItem => {
          if (fetchedItem) openTargetDetail(fetchedItem);
        })
        .catch(() => {});
    }
  }
});

// Web Audio API によるアラート音生成 (外部ファイル不要)
function playAlertSound() {
  if (!soundAlertEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // 2音の心地よいピロリン音 (チャイム)
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(587.33, now, 0.25); // D5
    playTone(880.00, now + 0.12, 0.35); // A5
  } catch (e) {
    console.warn("Audio play error:", e);
  }
}

// トースト通知表示
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "success" ? "✅" : type === "error" ? "⚠️" : "🔔";
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 🔍 検索中ローディングオーバーレイ制御
function showLoadingOverlay(title = "⚡ 4モール全件取得中...", desc = "メルカリ・ヤフオク・ヤフーフリマ・ラクマから最新の出品データをスキャンしています") {
  const overlay = document.getElementById("loading-overlay");
  const titleEl = document.getElementById("loading-overlay-title");
  const descEl = document.getElementById("loading-overlay-desc");
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (overlay) {
    overlay.classList.add("active");
    overlay.style.display = "flex";
    overlay.style.opacity = "1";
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.style.display = "none";
    overlay.style.opacity = "0";
  }
}

// データのロード
async function loadStatusAndRate() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const data = await res.json();
      currentUsdJpyRate = data.usd_jpy_rate || 155.0;
      currentRate = currentUsdJpyRate;
      document.getElementById("current-usd-jpy").textContent = `¥${currentUsdJpyRate.toFixed(2)}`;
    }
  } catch (e) {
    console.error("Failed to load status:", e);
  }
}

async function loadTargets() {
  try {
    const res = await fetch("/api/targets");
    if (res.ok) {
      targetItems = await res.json();
      const countBadge = document.getElementById("target-count");
      const totalCount = document.getElementById("targets-total-count");
      if (countBadge) countBadge.textContent = targetItems.length;
      if (totalCount) totalCount.textContent = targetItems.length;

      // 1. 商品絞り込みセレクトボックス(filter-target)の選択肢を動的に更新
      const filterSelect = document.getElementById("filter-target");
      if (filterSelect) {
        const curVal = filterSelect.value || "all";
        filterSelect.innerHTML = '<option value="all">すべての商品</option>';
        targetItems.forEach(t => {
          const opt = document.createElement("option");
          opt.value = String(t.id);
          opt.textContent = t.name;
          if (String(t.id) === curVal) opt.selected = true;
          filterSelect.appendChild(opt);
        });
      }

      // 2. メインテーブルおよび左サイドバーのアコーディオンを描画
      renderTargetsTable();
    }
  } catch (e) {
    console.error("Failed to load targets:", e);
  }
}

async function loadDetections(resetFilterToAll = false) {
  try {
    const hiddenOnly = document.getElementById("filter-hidden-only")?.checked || false;
    if (resetFilterToAll) {
      const filterSelect = document.getElementById("filter-target");
      if (filterSelect) filterSelect.value = "all";
    }
    const url = hiddenOnly ? "/api/detections?limit=100&show_hidden=true" : "/api/detections?limit=100&show_hidden=false";
    const res = await fetch(url);
    if (res.ok) {
      detections = await res.json();
      document.getElementById("detection-count").textContent = detections.length;
      renderDetections();
    }
  } catch (e) {
    console.error("Failed to load detections:", e);
  }
}

// リアルタイムイベントポーリング (新着出品検知用 & 状態・配送日数の自動更新)
let enrichPollingTimer = null;
async function pollEvents() {
  try {
    const res = await fetch("/api/events");
    if (res.ok) {
      const events = await res.json();
      if (events && events.length > 0) {
        let needFullReload = false;
        events.forEach(ev => {
          if (ev.type === "enrich_update") {
            // 状態・発送日数の更新イベント
            const it = detections.find(d => d.item_url === ev.item_url);
            if (it) {
              it.condition = ev.condition;
              it.shipping_days = ev.shipping_days;
            }
            needFullReload = true;
          } else {
            // 通常の新着検知イベント
            playAlertSound();
            showToast(`【新着検知】${ev.title} (¥${ev.price_jpy?.toLocaleString() || ''})`, "success");
            needFullReload = true;
          }
        });
        if (needFullReload) {
          renderDetections();
        }
      }
    }
    
    // 画面上に「⏳ 取得中」または「出品ページ参照」のカードがまだある場合はバックエンドから最新データを自動同期
    const hasLoading = detections.some(d => (d.condition && (d.condition.includes("取得中") || d.condition.includes("参照"))));
    if (hasLoading) {
      await loadDetections();
    }
  } catch (e) {
    console.debug("Poll error:", e);
  }
}

// 🎯 サイドバーの対象商品をハイライト（活性化）＆所属カテゴリーを自動展開（他カテゴリーは自動折りたたみ）
function highlightSidebarTarget(targetId) {
  if (!targetId || targetId === "all") {
    document.querySelectorAll(".sidebar-subitem").forEach(el => el.classList.remove("active"));
    return;
  }
  const strId = String(targetId);
  let activeCatGroup = null;

  document.querySelectorAll(".sidebar-subitem").forEach(el => {
    const isMatch = String(el.getAttribute("data-id")) === strId;
    if (isMatch) {
      el.classList.add("active");
      activeCatGroup = el.closest(".sidebar-cat-group");
    } else {
      el.classList.remove("active");
    }
  });

  // 他のカテゴリーグループをすべて自動折りたたみ、アクティブなカテゴリーだけを開く
  if (activeCatGroup) {
    document.querySelectorAll(".sidebar-cat-group").forEach(group => {
      if (group === activeCatGroup) {
        group.classList.add("open");
        const titleEl = group.querySelector(".cat-header-title span:last-child");
        if (titleEl && window.openCategories) {
          window.openCategories.clear();
          window.openCategories.add(titleEl.textContent.trim());
        }
      } else {
        group.classList.remove("open");
      }
    });
  }
}

// 描画: ピックアップフィード
function renderDetections(forceTargetId = null) {
  if (forceTargetId instanceof Event) {
    forceTargetId = null;
  }
  const filterSelect = document.getElementById("filter-target");
  const hiddenOnly = document.getElementById("filter-hidden-only")?.checked || false;
  
  let currentFilterVal = forceTargetId !== null ? String(forceTargetId) : (filterSelect && filterSelect.value ? String(filterSelect.value) : "all");
  if (hiddenOnly && forceTargetId === null) {
    currentFilterVal = "all";
  }
  if (filterSelect && forceTargetId !== null) {
    filterSelect.value = currentFilterVal;
  }

  // 🎯 左サイドバーの該当商品をハイライト表示＆カテゴリー自動開閉
  highlightSidebarTarget(currentFilterVal);
  
  const container = document.getElementById("detections-container");
  const empty = document.getElementById("detections-empty");
  const sortSelect = document.getElementById("sort-detections");
  const sortBy = sortSelect ? sortSelect.value : "discount";

  // 💡 安全フィルター & 非表示リスト完全分離フィルター
  const validDetections = detections.filter(item => {
    const isHidden = (item.is_hidden === 1 || item.is_hidden === true || item.is_hidden === "1");
    if (hiddenOnly) {
      // 🚫 非表示リストモード: is_hidden = 1 の商品のみを確実に抽出！
      return isHidden;
    } else {
      // ⚡ 通常一覧モード: is_hidden = 1 の商品は絶対に除外！
      if (isHidden) return false;
      if (item.is_saved === 1 || item.is_saved === true) return true;
      if (item.is_auction === 1 || item.is_auction === true) return true;
      if (item.price_jpy <= 500) return false;
      return true;
    }
  });

  // サイドバーのバッジ件数を有効件数に更新
  const navBadge = document.getElementById("nav-detection-count");
  if (navBadge && !hiddenOnly) {
    navBadge.textContent = validDetections.length;
  }

  // ターゲット絞り込みオプションの更新 (登録されている全商品を表示)
  const targetMap = new Map();
  if (Array.isArray(targetItems)) {
    targetItems.forEach(t => {
      targetMap.set(String(t.id), t.name);
    });
  }
  validDetections.forEach(d => {
    if (d.target_item_id && d.target_name && !targetMap.has(String(d.target_item_id))) {
      targetMap.set(String(d.target_item_id), d.target_name);
    }
  });

  if (currentFilterVal !== "all" && !targetMap.has(currentFilterVal)) {
    currentFilterVal = "all";
  }

  if (filterSelect) {
    filterSelect.innerHTML = `<option value="all" ${currentFilterVal === "all" ? "selected" : ""}>すべての商品 (${validDetections.length}件)</option>`;
    targetMap.forEach((name, id) => {
      const count = validDetections.filter(d => String(d.target_item_id) === String(id)).length;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${name} (${count}件)`;
      if (String(id) === currentFilterVal) opt.selected = true;
      filterSelect.appendChild(opt);
    });
    filterSelect.value = currentFilterVal;
  }

  // 🎯 検索モード＆商品アクションボタン（チェック・全検索・条件編集）の表示制御
  // 「すべての商品」または「非表示リスト」選択時は非表示、通常時の特定商品選択時のみ表示！
  const searchModeGroup = document.getElementById("feed-search-mode-group");
  const actionBtns = document.getElementById("target-action-buttons");
  const isSpecificTarget = (currentFilterVal !== "all") && !hiddenOnly;

  if (searchModeGroup) {
    searchModeGroup.style.display = isSpecificTarget ? "flex" : "none";
  }
  if (actionBtns) {
    actionBtns.style.display = isSpecificTarget ? "flex" : "none";
  }

  // ソート
  let list = [...validDetections];
  if (sortBy === "ebay_desc") {
    list.sort((a, b) => (b.ebay_price_jpy || 0) - (a.ebay_price_jpy || 0));
  } else if (sortBy === "ebay_asc") {
    list.sort((a, b) => (a.ebay_price_jpy || 0) - (b.ebay_price_jpy || 0));
  } else if (sortBy === "profit") {
    list.sort((a, b) => b.est_profit_jpy - a.est_profit_jpy);
  } else if (sortBy === "discount") {
    list.sort((a, b) => b.discount_pct - a.discount_pct);
  } else if (sortBy === "price_asc") {
    list.sort((a, b) => a.price_jpy - b.price_jpy);
  } else {
    list.sort((a, b) => b.id - a.id);
  }

  // 🎯 商品ID（ターゲット）による厳密な絞り込み（選択した商品以外の混入を100%防止）
  if (currentFilterVal !== "all") {
    list = list.filter(d => String(d.target_item_id) === currentFilterVal);
  }

  // 保存済みのみ絞り込み
  const savedOnly = document.getElementById("filter-saved-only")?.checked || false;
  if (savedOnly) {
    list = list.filter(d => d.is_saved === 1 || d.is_saved === true);
  }

  // 📦 出品中のみ絞り込み
  const listingOnly = document.getElementById("filter-listing-only")?.checked || false;
  if (listingOnly) {
    list = list.filter(d => d.is_listing === 1 || d.is_listing === true);
  }

  // 既存のカードをクリア（emptyは残す）
  const cards = container.querySelectorAll(".detection-card");
  cards.forEach(c => c.remove());

  if (list.length === 0) {
    const hiddenOnly = document.getElementById("filter-hidden-only")?.checked || false;
    empty.style.display = "block";
    const h3 = empty.querySelector("h3");
    const p = empty.querySelector("p");
    if (hiddenOnly) {
      if (h3) h3.textContent = "現在、非表示（もう見ない）にした商品はありません";
      if (p) p.textContent = "各商品カード右横の「🚫」ボタンを押すと、不要な出品を非表示にしてこのリストで管理・復元できます。";
    } else if (listingOnly) {
      if (h3) h3.textContent = "現在、出品中に指定された商品はありません";
      if (p) p.textContent = "仕入れ候補商品の右横にある「📦 出品中」ボタンをクリックすると、出品管理中の商品をここに集約できます。";
    } else if (savedOnly) {
      if (h3) h3.textContent = "現在、お気に入り保存中の商品はありません";
      if (p) p.textContent = "気になる商品の右横にある「⭐」ボタンをクリックすると、一覧をクリアしても消えないよう保存できます。";
    } else {
      if (h3) h3.textContent = "現在表示できるピックアップ商品がありません";
      if (p) p.textContent = "「🎯 登録商品リスト」タブから、調べたい商品の「⚡ チェック」ボタンをクリックしてください。現在出品中の仕入れ対象商品を自動抽出します。";
    }
    return;
  }
  empty.style.display = "none";

  list.forEach(item => {
    const card = document.createElement("div");
    const isSaved = item.is_saved === 1 || item.is_saved === true;
    const isListing = item.is_listing === 1 || item.is_listing === true;
    const isHiddenItem = (item.is_hidden === 1) || hiddenOnly;
    card.className = `detection-card ${isSaved ? 'is-saved-card' : ''} ${isListing ? 'is-listing-card' : ''} ${isHiddenItem ? 'is-hidden-card' : ''}`;

    const imgHtml = (item.image_url && !item.image_url.includes("dummy"))
      ? `<img src="${item.image_url}" alt="${item.title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='<span class=\\'no-image\\'>📷 画像なし</span>'">`
      : `<span class="no-image">📷 画像なし</span>`;

    let profitBadge = "";
    const isNegative = (item.discount_pct < 0) || (item.est_profit_jpy < 0);
    if (isNegative) {
      profitBadge = `<span class="profit-badge profit-badge-negative">利益率 ${item.discount_pct}%</span>`;
    } else if (item.discount_pct > 0) {
      profitBadge = `<span class="profit-badge">利益率 +${item.discount_pct}%</span>`;
    } else {
      profitBadge = `<span class="profit-badge" style="background:#64748b;">出品中</span>`;
    }

    // 1. 商品の状態バッジ (公式スペックデータを100%忠実にそのまま表示・推測排除)
    let rawCond = (item.condition || "").trim();
    let condText = "";
    let condClass = "cond-mid";

    if (rawCond && !rawCond.includes("出品ページ参照") && !rawCond.includes("取得中") && !rawCond.includes("未取得")) {
      condText = rawCond;
      if (rawCond.includes("新品") || rawCond.includes("未使用") || rawCond.includes("目立った傷や汚れなし") || rawCond.includes("美品")) {
        condClass = "cond-good";
      } else if (rawCond.includes("傷や汚れあり") || rawCond.includes("全体的に状態が悪い") || rawCond.includes("ジャンク") || rawCond.includes("難あり") || rawCond.includes("故障")) {
        condClass = "cond-bad";
      } else {
        condClass = "cond-mid";
      }
    } else if (rawCond.includes("取得中")) {
      condText = "⏳ 状態取得中...";
      condClass = "cond-mid";
    } else {
      condText = "出品ページで状態確認";
      condClass = "cond-mid";
    }

    const conditionBadge = `<span class="condition-badge ${condClass}">🏷️ ${condText}</span>`;

    // 2. 発送目安バッジ (公式スペックデータをそのまま表示)
    let rawShip = (item.shipping_days || "").trim();
    let shipText = "";
    let shipClass = "shipping-mid";

    if (rawShip && !rawShip.includes("出品ページ参照") && !rawShip.includes("取得中") && !rawShip.includes("---") && !rawShip.includes("未取得")) {
      let sClean = rawShip
        .replace(/お?支払い手続き(から|後)[、,]?\s*/g, '')
        .replace(/お?支払い(から|後)[、,]?\s*/g, '')
        .replace(/ご?入金確認後[、,]?\s*/g, '')
        .replace(/決済後[、,]?\s*/g, '')
        .trim();

      if (sClean === "1" || sClean === "1~2" || sClean === "1〜2" || sClean === "1-2") {
        shipText = "1〜2日で発送";
      } else if (sClean === "2" || sClean === "2~3" || sClean === "2〜3" || sClean === "2-3") {
        shipText = "2〜3日で発送";
      } else if (sClean === "4" || sClean === "4~7" || sClean === "4〜7" || sClean === "4-7") {
        shipText = "4〜7日で発送";
      } else {
        shipText = sClean;
        if (!shipText.endsWith("発送") && !shipText.endsWith("以内")) shipText += "で発送";
      }

      if (shipText.includes("即日") || shipText.includes("1〜2") || shipText.includes("1~2") || shipText.includes("24時間") || shipText.includes("当日") || shipText.includes("1-2")) {
        shipClass = "shipping-fast";
      } else if (shipText.includes("4〜7") || shipText.includes("4~7") || shipText.includes("4-7")) {
        shipClass = "shipping-slow";
      } else if (shipText.includes("2〜3") || shipText.includes("2~3") || shipText.includes("2-3")) {
        shipClass = "shipping-mid";
      }
    } else if (rawShip.includes("取得中")) {
      shipText = "⏳ 取得中...";
      shipClass = "shipping-mid";
    } else {
      shipText = "出品ページ参照";
      shipClass = "shipping-mid";
    }
    const shippingBadge = `<span class="shipping-badge ${shipClass}">🚚 ${shipText}</span>`;

    // 3. プラットフォームマーク＆カラー (左上の利益率バッジのすぐ下にすっきり配置、右側ボタンと完全分離)
    let platformIcon = "🌐";
    let platformClass = "platform-other";
    const pName = item.platform || "";
    const isAuction = item.is_auction === 1 || item.is_auction === true;
    
    let auctionTag = isAuction ? " 🔨入札" : "";

    if (pName.includes("メルカリ")) {
      platformIcon = "🔴";
      platformClass = "platform-メルカリ";
    } else if (pName.includes("ヤフオク")) {
      platformIcon = "🔨";
      platformClass = "platform-ヤフオク";
    } else if (pName.includes("Yahoo") || pName.includes("フリマ")) {
      platformIcon = "🛍️";
      platformClass = "platform-Yahooフリマ";
    } else if (pName.includes("ラクマ")) {
      platformIcon = "🔵";
      platformClass = "platform-ラクマ";
    }

    const platformBadgeHtml = `<span class="platform-badge ${platformClass}">${platformIcon} ${pName || 'フリマ'}${auctionTag}</span>`;

    const currencyPrefix = isAuction 
      ? `<span class="currency" style="color: #fbbf24; font-weight: 700; font-size: 13px; margin-right: 3px; letter-spacing: -0.2px; background: rgba(251, 191, 36, 0.15); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.3);">現在 ¥</span>` 
      : `<span class="currency">¥</span>`;

    // 🎯 商品右横の縦アクションバー (⭐ お気に入り / 📦 出品中 / 🚫 非表示)
    let actionBarHtml = "";
    if (hiddenOnly || item.is_hidden === 1) {
      actionBarHtml = `
        <div class="card-action-bar">
          <button class="btn-restore-item" 
                  data-id="${item.id}" 
                  title="クリックで通常一覧に復元">
            ↩️ 復元
          </button>
        </div>
      `;
    } else {
      const showHideBtn = !isSaved && !isListing;
      actionBarHtml = `
        <div class="card-action-bar">
          <button class="btn-card-action btn-save-item ${isSaved ? 'is-saved' : ''}" 
                  data-id="${item.id}" 
                  title="${isSaved ? '⭐ お気に入り（キープ中・クリックで解除）' : '☆ お気に入りに追加'}">
            ${isSaved ? '⭐' : '☆'}
          </button>
          <button class="btn-card-action btn-listing-item ${isListing ? 'is-listing' : ''}" 
                  data-id="${item.id}" 
                  title="${isListing ? '🚀 出品中（クリックで解除）' : '📦 出品中に設定'}">
            ${isListing ? '🚀' : '📦'}
          </button>
          <button class="btn-card-action btn-hide-item" 
                  data-id="${item.id}" 
                  style="${showHideBtn ? '' : 'display: none !important;'}"
                  title="🚫 非表示（もう見ない・再検索時も除外）">
            🚫
          </button>
        </div>
      `;
    }

    // 👀 直近閲覧（前回確認した1件のみ）判定
    const isLastViewed = String(item.id) === String(lastViewedItemId);
    if (isLastViewed) {
      card.classList.add('last-viewed-card');
    }
    const lastViewedBadgeHtml = isLastViewed ? `<span class="last-viewed-badge">👀 直前に確認</span>` : ``;

    // ステータスタグ（タイトル上部に表示）
    let statusTagsHtml = "";
    if (isListing) {
      statusTagsHtml += `<span class="listing-badge">🚀 出品中</span>`;
    }
    if (isSaved) {
      statusTagsHtml += `<span class="saved-badge">⭐ キープ</span>`;
    }

    card.innerHTML = `
      <div class="card-img-wrap">
        ${imgHtml}
        ${profitBadge}
        ${platformBadgeHtml}
        ${lastViewedBadgeHtml}
        ${actionBarHtml}
        ${conditionBadge}
        ${shippingBadge}
      </div>
      <div class="card-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <div class="card-target-name" style="margin-bottom: 0;">${item.target_name || '登録商品'}</div>
            ${statusTagsHtml}
            <button class="btn-card-edit-target" data-target-id="${item.target_item_id}" title="この商品の検索条件（キーワード・上限価格等）を編集して再検索" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); cursor: pointer; color: #38bdf8; font-size: 11px; padding: 1px 5px; border-radius: 4px; transition: all 0.2s;">
              ⚙️ 条件編集
            </button>
          </div>
          <span class="detected-time" style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">🕒 ${item.detected_at || ''}</span>
        </div>
        <a href="${item.item_url}" target="_blank" rel="noopener" class="card-title">${item.title}</a>
        
        <div class="price-row">
          <div class="domestic-price-wrap" style="flex-direction: column; align-items: flex-start; gap: 2px;">
            <div style="display: flex; align-items: baseline;">
              ${currencyPrefix}
              <span class="domestic-price">${item.price_jpy ? item.price_jpy.toLocaleString() : '0'}</span>
            </div>
            ${item.shipping_fee_jpy && item.shipping_fee_jpy > 0 ? `
              <span style="font-size: 11px; color: #38bdf8; font-family: var(--font-mono); font-weight: 600; background: rgba(56, 189, 248, 0.1); padding: 1px 4px; border-radius: 3px;">
                (本体¥${(item.raw_price_jpy || (item.price_jpy - item.shipping_fee_jpy)).toLocaleString()} + 🚚送料¥${item.shipping_fee_jpy.toLocaleString()})
              </span>
            ` : ''}
          </div>
          <div class="ebay-ref-price">
            <span>eBay相場: ¥${item.ebay_price_jpy ? Math.round(item.ebay_price_jpy).toLocaleString() : '未設定'}</span>
            <a href="https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.target_name || item.title)}&LH_Sold=1&LH_Complete=1" target="_blank" rel="noopener" class="ebay-sold-link" title="eBayで直近の販売実績（落札・販売相場）を確認">
              📈 eBay販売実績 ↗
            </a>
          </div>
        </div>

        <div class="${isNegative ? 'profit-box profit-box-negative' : 'profit-box'}">
          <span class="profit-label">💵 見込み利益 (ROI ${item.discount_pct > 0 ? '+' : ''}${Math.round(item.discount_pct || 0)}%)</span>
          <span class="profit-value">${(item.est_profit_jpy || 0) > 0 ? '+' : ''}¥${Math.round(item.est_profit_jpy || 0).toLocaleString()}</span>
        </div>
      </div>
    `;

    // 🚫 もう見ない（非表示）ボタンクリックイベント
    const hideBtn = card.querySelector('.btn-hide-item');
    if (hideBtn) {
      hideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleHideItem(item.id, card);
      });
    }

    // ↩️ 復元ボタンクリックイベント (非表示リスト用)
    const restoreBtn = card.querySelector('.btn-restore-item');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleHideItem(item.id, card);
      });
    }

    // ⭐ 保存（キープ）ボタンクリックイベント
    const saveBtn = card.querySelector('.btn-save-item');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaveItem(item.id, card);
      });
    }

    // 📦 出品中ボタンクリックイベント
    const listingBtn = card.querySelector('.btn-listing-item');
    if (listingBtn) {
      listingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleListingItem(item.id, card);
      });
    }

    // ⚙️ カード内の条件編集ボタンクリック
    const editBtn = card.querySelector('.btn-card-edit-target');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = targetItems.find(t => t.id === item.target_item_id);
        if (target) {
          openTargetDetail(target);
        } else {
          showToast("該当の登録商品データが見つかりません", "warning");
        }
      });
    }

    // 👀 商品名をクリックした際に「直前に確認（最新の1件）」マークを更新
    const titleLink = card.querySelector('.card-title');
    if (titleLink) {
      titleLink.addEventListener('click', () => {
        markItemAsLastViewed(item.id, card);
      });
    }

    container.appendChild(card);
  });
}

// 描画: ターゲットテーブル
function renderTargetsTable() {
  const tbody = document.getElementById("targets-table-body");
  const sublist = document.getElementById("sidebar-targets-sublist");
  const sortSelect = document.getElementById("sort-targets");
  const catFilterSelect = document.getElementById("filter-target-category");
  const countEl = document.getElementById("targets-total-count");
  const sidebarCountEl = document.getElementById("target-count");

  if (sidebarCountEl) {
    sidebarCountEl.textContent = targetItems.length;
  }

  tbody.innerHTML = "";
  if (sublist) sublist.innerHTML = "";

  if (targetItems.length === 0) {
    if (countEl) countEl.textContent = "0";
    if (sidebarCountEl) sidebarCountEl.textContent = "0";
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
          監視中の商品がありません。「商品を追加」ボタンから登録してください。
        </td>
      </tr>
    `;
    return;
  }

  // カテゴリーフィルターのオプション更新
  if (catFilterSelect) {
    const currentCat = catFilterSelect.value || "all";
    const cats = new Set(["all"]);
    targetItems.forEach(t => {
      let c = t.category || "📁 その他・未分類";
      if (!c.trim()) c = "📁 その他・未分類";
      cats.add(c);
    });
    catFilterSelect.innerHTML = "";
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c === "all" ? "すべてのカテゴリー" : c;
      if (c === currentCat) opt.selected = true;
      catFilterSelect.appendChild(opt);
    });
  }

  // 🎯 サイドバーのサブリストをアコーディオンツリー（デフォルト折りたたみ）として生成
  if (typeof window.openCategories === "undefined") {
    window.openCategories = new Set();
  }

  if (sublist) {
    sublist.innerHTML = "";
    
    // カテゴリーごとに分類
    const catGroups = {};
    targetItems.forEach(item => {
      let cat = item.category || "";
      if (!cat || cat.trim() === "") {
        // 自動推測
        const n = item.name.toLowerCase();
        if (n.includes("dmc") || n.includes("s110") || n.includes("ixy") || n.includes("camera") || n.includes("powershot") || n.includes("lumix")) {
          cat = "📷 デジタルカメラ";
        } else if (n.includes("3ds") || n.includes("vita") || n.includes("pch") || n.includes("ps") || n.includes("switch") || n.includes("nintendo")) {
          cat = "🎮 ゲーム機本体";
        } else {
          cat = "📁 その他・未分類";
        }
      }
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(item);
    });

    for (const [catName, items] of Object.entries(catGroups)) {
      // 💡 各カテゴリー内の商品をeBay相場（高い順）に自動ソート
      items.sort((a, b) => {
        const ebayA = a.ebay_price_jpy || (a.ebay_price_usd ? a.ebay_price_usd * currentUsdJpyRate : 0);
        const ebayB = b.ebay_price_jpy || (b.ebay_price_usd ? b.ebay_price_usd * currentUsdJpyRate : 0);
        return ebayB - ebayA;
      });

      const isOpen = window.openCategories.has(catName);

      const groupEl = document.createElement("div");
      groupEl.className = `sidebar-cat-group ${isOpen ? 'open' : ''}`;
      
      const headerEl = document.createElement("div");
      headerEl.className = "sidebar-cat-header";
      headerEl.innerHTML = `
        <div class="cat-header-title">
          <span class="cat-arrow">▶</span>
          <span>${catName}</span>
        </div>
        <span class="cat-count" style="background: rgba(255, 255, 255, 0.1); padding: 1px 7px; border-radius: 10px; font-size: 11px; color: #94a3b8;">${items.length}</span>
      `;

      const itemContainer = document.createElement("div");
      itemContainer.className = "sidebar-subitem-container";

      // ヘッダークリックで対象カテゴリーをスムーズに開閉トグル
      headerEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !groupEl.classList.contains("open");
        if (willOpen) {
          groupEl.classList.add("open");
          if (window.openCategories) window.openCategories.add(catName);
        } else {
          groupEl.classList.remove("open");
          if (window.openCategories) window.openCategories.delete(catName);
        }
      });

      items.forEach(item => {
        const a = document.createElement("a");
        a.className = "sidebar-subitem";
        a.href = "javascript:void(0)";
        a.setAttribute("data-id", item.id);
        const ebayJpy = Math.round(item.ebay_price_jpy || (item.ebay_price_usd ? item.ebay_price_usd * currentUsdJpyRate : 0));
        const ebayText = ebayJpy > 0 ? `¥${ebayJpy.toLocaleString()}` : (item.ebay_price_usd ? `$${item.ebay_price_usd}` : "¥0");
        a.innerHTML = `
          <span class="subitem-name" title="${item.name}">${item.name}</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span class="subitem-badge" title="eBay販売相場">${ebayText}</span>
            <button class="btn-subitem-del" title="この監視商品を削除">✕</button>
          </div>
        `;
        a.addEventListener("click", () => {
          openTargetDetail(item);
        });

        // 🗑️ サイドバーからの直接削除
        const delBtn = a.querySelector(".btn-subitem-del");
        if (delBtn) {
          delBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm(`監視対象「${item.name}」を削除しますか？`)) return;
            try {
              const res = await fetch(`/api/targets/${item.id}`, { method: "DELETE" });
              if (res.ok) {
                showToast(`「${item.name}」を削除しました`, "info");
                await loadTargets();
              }
            } catch (err) {
              showToast("削除エラー", "error");
            }
          });
        }

        itemContainer.appendChild(a);
      });

      groupEl.appendChild(headerEl);
      groupEl.appendChild(itemContainer);
      sublist.appendChild(groupEl);
    }

    // 現在選択中の商品があれば即座にハイライト＆自動展開を同期
    const filterSelect = document.getElementById("filter-target");
    if (filterSelect && filterSelect.value) {
      highlightSidebarTarget(filterSelect.value);
    }
  }

  // メインテーブル用リストのフィルタリングとソート
  let displayList = [...targetItems];
  
  // カテゴリー絞り込み (安全ガード付き)
  let selectedCat = catFilterSelect ? catFilterSelect.value : "all";
  if (!selectedCat) selectedCat = "all";
  if (selectedCat !== "all") {
    const filtered = displayList.filter(t => (t.category || "📁 その他・未分類") === selectedCat);
    if (filtered.length > 0) {
      displayList = filtered;
    }
  }

  // ソート
  const sortMode = sortSelect ? sortSelect.value : "ebay_desc";
  if (sortMode === "ebay_desc") {
    displayList.sort((a, b) => {
      const pA = a.ebay_price_jpy || (a.ebay_price_usd ? a.ebay_price_usd * currentUsdJpyRate : 0);
      const pB = b.ebay_price_jpy || (b.ebay_price_usd ? b.ebay_price_usd * currentUsdJpyRate : 0);
      return pB - pA;
    });
  } else if (sortMode === "ebay_asc") {
    displayList.sort((a, b) => {
      const pA = a.ebay_price_jpy || (a.ebay_price_usd ? a.ebay_price_usd * currentUsdJpyRate : 0);
      const pB = b.ebay_price_jpy || (b.ebay_price_usd ? b.ebay_price_usd * currentUsdJpyRate : 0);
      return pA - pB;
    });
  } else if (sortMode === "max_price_desc") {
    displayList.sort((a, b) => (b.max_buy_price_jpy || 0) - (a.max_buy_price_jpy || 0));
  } else if (sortMode === "profit_pct_desc") {
    displayList.sort((a, b) => (b.target_discount_pct || 0) - (a.target_discount_pct || 0));
  } else if (sortMode === "name_asc") {
    displayList.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  } else {
    // 登録順（新着順）
    displayList.sort((a, b) => b.id - a.id);
  }

  if (countEl) countEl.textContent = displayList.length;

  displayList.forEach(item => {
    const tr = document.createElement("tr");
    const ebayInfo = item.ebay_price_usd > 0 
      ? `$${item.ebay_price_usd} <span style="font-size: 11px; color: var(--text-dim);">(約¥${Math.round(item.ebay_price_jpy).toLocaleString()})</span>`
      : `¥${Math.round(item.ebay_price_jpy).toLocaleString()}`;

    const excludeText = item.exclude_keywords ? `🚫 除外: ${item.exclude_keywords}` : "🚫 除外: なし";
    const lastChecked = item.last_checked_at ? `🕒 最終チェック: ${item.last_checked_at}` : "🕒 最終チェック: 未実行";

    tr.innerHTML = `
      <td>
        <span class="badge-status ${item.is_active ? 'active' : 'paused'}">
          ${item.is_active ? '● 監視中' : '停止中'}
        </span>
      </td>
      <td style="cursor: pointer;" title="クリックして詳細スペック・キーワード設定を開く">
        <div class="target-row-title-wrap" style="display: flex; flex-direction: column; gap: 4px;">
          <!-- 1行目: 商品名 -->
          <div style="font-size: 14px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;">
            <span>${item.name}</span>
            <span style="font-size: 11px; color: #38bdf8; font-weight: normal;">📝 詳細・スペック</span>
          </div>
          <!-- 2行目: 検索キーワード・除外ワード・最終チェック -->
          <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-dim); flex-wrap: wrap;">
            <span style="background: rgba(30, 41, 59, 0.9); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3); color: #7dd3fc; font-family: var(--font-mono);">
              🔍 ${item.keyword}
            </span>
            <span style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.exclude_keywords || ''}">
              ${excludeText}
            </span>
            <span style="color: #64748b;">
              ${lastChecked}
            </span>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">${ebayInfo}</div>
      </td>
      <td>
        <div style="font-size: 15px; font-weight: 800; color: var(--accent-green);">¥${Math.round(item.max_buy_price_jpy).toLocaleString()}</div>
      </td>
      <td>
        <span style="color: #34d399; font-weight: 700; font-size: 13px;">+${item.target_discount_pct}%</span>
      </td>
      <td style="text-align: right;">
        <div style="display: flex; gap: 6px; justify-content: flex-end;">
          <button class="btn btn-secondary btn-check-target" data-id="${item.id}" style="padding: 5px 10px; font-size: 12px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);" title="今すぐ手動チェック">⚡ チェック</button>
          <button class="btn btn-secondary btn-open-detail-row" data-id="${item.id}" style="padding: 5px 8px; font-size: 11px;" title="詳細スペック・設定を開く">📝 詳細</button>
          <button class="btn btn-danger btn-delete-target" data-id="${item.id}" style="padding: 5px 8px; font-size: 11px;" title="削除">🗑️</button>
        </div>
      </td>
    `;

    // タイトルまたは詳細ボタンクリックでスペック詳細へ
    tr.querySelector(".target-row-title-wrap").addEventListener("click", () => openTargetDetail(item));
    tr.querySelector(".btn-open-detail-row").addEventListener("click", () => openTargetDetail(item));

    tbody.appendChild(tr);
  });

  // 個別チェック
  tbody.querySelectorAll(".btn-check-target").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const modeSelect = document.getElementById("detail-search-mode-select") || document.getElementById("feed-search-mode-select");
      const searchMode = modeSelect ? modeSelect.value : "recent";
      const modeLabel = searchMode === "all" ? "全体（網羅）" : "直近";
      
      btn.textContent = "⌛";
      showToast(`一覧をリセットし、4モールを【${modeLabel}】検索中...`, "info");
      try {
        // 1. まず一覧をクリア
        await fetch("/api/detections", { method: "DELETE" });

        // 2. この商品のチェック処理を実行
        const res = await fetch(`/api/targets/${id}/check?search_mode=${searchMode}`, { method: "POST" });
        const data = await res.json();
        showToast(`4モールから ${data.count} 件の最新確定商品を検出！`, "success");
        await loadDetections();
        await loadTargets();
        
        // 3. ピックアップ一覧タブを開き、この商品で絞り込み
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
        const tabDet = document.getElementById("tab-detections");
        if (tabDet) tabDet.classList.add("active");
        const filterSelect = document.getElementById("filter-target");
        if (filterSelect) filterSelect.value = id;
        renderDetections();
      } catch (e) {
        showToast("チェックエラーが発生しました", "error");
      } finally {
        btn.textContent = "⚡ チェック";
      }
    });
  });

  // 削除
  tbody.querySelectorAll(".btn-delete-target").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("この監視商品を削除しますか？")) return;
      const id = btn.getAttribute("data-id");
      try {
        await fetch(`/api/targets/${id}`, { method: "DELETE" });
        showToast("監視商品を削除しました", "info");
        loadTargets();
      } catch (e) {
        showToast("削除エラー", "error");
      }
    });
  });
}

// 🎯 商品詳細・スペック管理画面を開く関数
function openTargetDetail(item) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'TARGET_ITEM_SELECTED', targetId: String(item.id) }, '*');
  }

  // サイドバーのアクティブ状態を更新
  document.querySelectorAll(".sidebar-subitem").forEach(el => {
    el.classList.toggle("active", el.getAttribute("data-id") == item.id);
  });

  // タブ切り替え（他のタブを隠し、tab-target-detail を表示）
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  
  const detailTab = document.getElementById("tab-target-detail");
  if (detailTab) detailTab.classList.add("active");

  // ページタイトル更新
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = `📝 商品マスター詳細設定`;
  const descEl = document.getElementById("page-desc");
  if (descEl) descEl.textContent = `検索キーワード・除外条件・相場計算・eBay出品用スペックメモ（400文字）`;

  // フォームにデータをロード
  document.getElementById("detail-item-id").value = item.id;
  document.getElementById("detail-item-title").textContent = item.name;
  document.getElementById("detail-name").value = item.name;
  document.getElementById("detail-keyword").value = item.keyword;
  
  const catSelect = document.getElementById("detail-category-select");
  if (catSelect) {
    let cat = item.category || "";
    if (!cat || cat.trim() === "") {
      const n = item.name.toLowerCase();
      if (n.includes("dmc") || n.includes("s110") || n.includes("ixy") || n.includes("camera") || n.includes("powershot") || n.includes("lumix")) {
        cat = "📷 デジタルカメラ";
      } else if (n.includes("3ds") || n.includes("vita") || n.includes("pch") || n.includes("ps") || n.includes("switch") || n.includes("nintendo")) {
        cat = "🎮 ゲーム機本体";
      } else {
        cat = "📁 その他・未分類";
      }
    }
    catSelect.value = cat;
  }
  
  const ebayJpyVal = Math.round(item.ebay_price_jpy || (item.ebay_price_usd ? item.ebay_price_usd * currentRate : 0));
  document.getElementById("detail-ebay-jpy").value = ebayJpyVal || "";
  document.getElementById("detail-shipping-jpy").value = Math.round(item.est_shipping_jpy || 0);
  document.getElementById("detail-discount-pct").value = item.target_discount_pct || 30;
  
  // 💡 見込み利益額と仕入れ上限価格の初期自動計算＆反映
  calcDetailMaxPrice("from_pct");
  if (item.max_buy_price_jpy > 0) {
    document.getElementById("detail-max-price").value = Math.round(item.max_buy_price_jpy);
  }

  document.getElementById("detail-exclude").value = item.exclude_keywords || "";
  
  const specsText = item.specs_note || "";
  const specsTextarea = document.getElementById("detail-specs-note");
  specsTextarea.value = specsText;
  updateSpecsCounter(specsText.length);

  const statusBadge = document.getElementById("detail-status-badge");
  if (statusBadge) {
    statusBadge.className = `badge-status ${item.is_active ? 'active' : 'paused'}`;
    statusBadge.textContent = item.is_active ? '● 監視中' : '停止中';
  }

  // この商品のピックアップ件数をバッジに反映
  const itemDetections = detections.filter(d => d.target_id == item.id || (d.target_name && d.target_name === item.name));
  const countBadge = document.getElementById("detail-item-detection-count");
  if (countBadge) {
    countBadge.textContent = itemDetections.length;
  }

  const lastCheckedText = document.getElementById("detail-last-checked-text");
  if (lastCheckedText) {
    lastCheckedText.textContent = item.last_checked_at ? `🕒 最終チェック日時: ${item.last_checked_at}` : '🕒 最終チェック日時: 未実行';
  }
}

// 🎯 詳細マスターの送料・利益額・利益率・仕入れ上限価格 相互自動計算
function calcDetailMaxPrice(source = "from_pct") {
  const inputEbayJpy = document.getElementById("detail-ebay-jpy");
  const inputShippingJpy = document.getElementById("detail-shipping-jpy");
  const inputProfitAmount = document.getElementById("detail-profit-amount");
  const inputProfitPct = document.getElementById("detail-discount-pct");
  const inputMaxPrice = document.getElementById("detail-max-price");
  const textDetail = document.getElementById("detail-calc-detail-text");

  if (!inputEbayJpy || !inputProfitPct || !inputMaxPrice) return;

  const itemPrice = parseFloat(inputEbayJpy.value) || 0;
  const shipping = parseFloat(inputShippingJpy ? inputShippingJpy.value : 0) || 0;
  updateDetailUsdText(itemPrice);

  if (itemPrice > 0) {
    const totalCharged = itemPrice + shipping; // バイヤー支払総額
    const fee = totalCharged * 0.12; // eBay手数料 (本体+送料に12%)
    const netPayout = totalCharged - fee - shipping; // セラー実質手取り (送料実費差引後)

    let profitAmount = 0;
    let profitPct = 30;

    if (source === "from_amount" && inputProfitAmount) {
      profitAmount = parseFloat(inputProfitAmount.value) || 0;
      profitPct = (profitAmount / itemPrice) * 100;
      inputProfitPct.value = profitPct.toFixed(1);
    } else {
      profitPct = parseFloat(inputProfitPct.value) || 30;
      profitAmount = Math.round(itemPrice * (profitPct / 100.0));
      if (inputProfitAmount) inputProfitAmount.value = profitAmount;
    }

    // 仕入れ上限 ＝ 実質手取り − 利益額
    const autoMax = Math.max(0, Math.round(netPayout - profitAmount));
    inputMaxPrice.value = autoMax;

    if (textDetail) {
      if (shipping > 0) {
        textDetail.textContent = `💡 総売上 ¥${Math.round(totalCharged).toLocaleString()} (送料¥${Math.round(shipping).toLocaleString()}込) − 手数料12% ¥${Math.round(fee).toLocaleString()} − 送料実費 ¥${Math.round(shipping).toLocaleString()} − 利益 ¥${Math.round(profitAmount).toLocaleString()} (${profitPct.toFixed(1)}%) ＝ 上限 ¥${autoMax.toLocaleString()}`;
      } else {
        textDetail.textContent = `💡 手取り ¥${Math.round(netPayout).toLocaleString()} (手数料12%: ¥${Math.round(fee).toLocaleString()}) − 利益 ¥${Math.round(profitAmount).toLocaleString()} (${profitPct.toFixed(1)}%) ＝ 上限 ¥${autoMax.toLocaleString()}`;
      }
    }
  } else {
    if (inputProfitAmount) inputProfitAmount.value = "";
    if (textDetail) {
      textDetail.textContent = `※ (相場＋送料) − 利益額 − 手数料12% − 送料 で自動計算されます`;
    }
  }
}

// 日本円相場からUSD換算テキストを更新
function updateDetailUsdText(jpy) {
  const textEl = document.getElementById("detail-ebay-usd-text");
  if (textEl && currentRate > 0) {
    const usd = (jpy / currentRate).toFixed(2);
    textEl.textContent = `※ 約 $${usd} (為替: ¥${currentRate})`;
  }
}

// スペックメモ文字数カウンター更新 (最大1500文字)
function updateSpecsCounter(len) {
  const counter = document.getElementById("detail-specs-counter");
  if (counter) {
    counter.textContent = `${len} / 1500文字`;
    counter.style.color = len > 1500 ? "#f87171" : "#34d399";
  }
}

// 🎯 商品詳細マスター画面のイベントリスナー初期化
function setupDetailMasterHandlers() {
  const specsTextarea = document.getElementById("detail-specs-note");
  if (specsTextarea) {
    specsTextarea.addEventListener("input", (e) => {
      updateSpecsCounter(e.target.value.length);
    });
  }

  // eBay日本円相場・国際送料・利益額・利益率の相互リアルタイム自動連動
  const inputEbayJpy = document.getElementById("detail-ebay-jpy");
  const inputShippingJpy = document.getElementById("detail-shipping-jpy");
  const inputProfitAmount = document.getElementById("detail-profit-amount");
  const inputProfitPct = document.getElementById("detail-discount-pct");

  if (inputEbayJpy) inputEbayJpy.addEventListener("input", () => calcDetailMaxPrice("from_pct"));
  if (inputShippingJpy) inputShippingJpy.addEventListener("input", () => calcDetailMaxPrice("from_pct"));
  if (inputProfitPct) inputProfitPct.addEventListener("input", () => calcDetailMaxPrice("from_pct"));
  if (inputProfitAmount) inputProfitAmount.addEventListener("input", () => calcDetailMaxPrice("from_amount"));

  // スペックをコピー
  const btnCopy = document.getElementById("detail-btn-copy-specs");
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      const text = document.getElementById("detail-specs-note").value;
      if (!text) {
        showToast("コピーするスペックテキストがありません", "info");
        return;
      }
      navigator.clipboard.writeText(text).then(() => {
        showToast("📋 商品スペックをクリップボードにコピーしました！", "success");
      });
    });
  }

  // 全体一覧に戻る
  const btnBack = document.getElementById("detail-btn-back-list");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      document.querySelector('[data-tab="tab-targets"]').click();
    });
  }

  // 📋 この商品のピックアップ一覧を見る
  const btnViewDetections = document.getElementById("detail-btn-view-detections");
  if (btnViewDetections) {
    btnViewDetections.addEventListener("click", () => {
      const id = document.getElementById("detail-item-id").value;
      const targetName = document.getElementById("detail-name").value || "選択商品";
      if (!id) return;
      
      // ピックアップタブを表示
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      const tabDet = document.getElementById("tab-detections");
      if (tabDet) tabDet.classList.add("active");
      
      // 検索モードの取得
      const modeSelect = document.getElementById("detail-search-mode-select");
      const sMode = modeSelect ? modeSelect.value : "recent";
      const isAllMode = sMode === "all";

      document.getElementById("page-title").innerHTML = isAllMode 
        ? `🌐 全体網羅検索一覧 <span style="font-size:14px; font-weight:600; color:#38bdf8; background:#0b1322; padding:3px 8px; border-radius:6px; border:1px solid #38bdf8; margin-left:8px;">[${targetName}]</span>`
        : `⚡ 新着・ピックアップ一覧 <span style="font-size:14px; font-weight:600; color:#34d399; background:#0b1322; padding:3px 8px; border-radius:6px; border:1px solid #34d399; margin-left:8px;">[${targetName}]</span>`;
        
      document.getElementById("page-desc").textContent = isAllMode
        ? `【🌐 全体（網羅）モード】過去出品を含む全期間から抽出された「${targetName}」の出品一覧`
        : `【⚡ 直近（新着）モード】24時間〜直近に出品された「${targetName}」の新着仕入れチャンス一覧`;

      // フィードコントロールバーの検索モードも同期
      const feedModeSelect = document.getElementById("feed-search-mode-select");
      if (feedModeSelect) feedModeSelect.value = sMode;

      // 商品フィルターをこの商品に自動設定
      const filterSelect = document.getElementById("filter-target");
      if (filterSelect) {
        filterSelect.value = id;
      }
      renderDetections(id);
    });
  }

  // この商品を今すぐチェック (通常: 仕入れ上限内)
  const btnCheckNow = document.getElementById("detail-btn-check-now");
  if (btnCheckNow) {
    btnCheckNow.addEventListener("click", async () => {
      const id = document.getElementById("detail-item-id")?.value;
      const targetName = document.getElementById("detail-name")?.value || "選択商品";
      if (!id) return;
      const modeSelect = document.getElementById("detail-search-mode-select");
      const searchMode = modeSelect ? modeSelect.value : "recent";
      const isAllMode = searchMode === "all";
      const modeLabel = isAllMode ? "全体（網羅）" : "直近（新着）";

      btnCheckNow.textContent = "⌛ 検索中...";
      showLoadingOverlay(`⚡ 「${targetName}」を4モール【${modeLabel}】取得中...`, "フォーム設定を最新状態に同期し、メルカリ・ヤフオク・ヤフーフリマ・ラクマから最新商品を自動抽出しています");
      showToast(`フォーム設定を最新状態に同期し、4モールを【${modeLabel}】検索中...`, "info");
      try {
        // 1. 最新のフォーム入力条件を自動保存（安全ガード付き）
        try {
          const name = document.getElementById("detail-name")?.value?.trim() || targetName;
          const keyword = document.getElementById("detail-keyword")?.value?.trim() || name;
          const catSelect = document.getElementById("detail-category-select");
          const category = catSelect ? catSelect.value : "📁 その他・未分類";
          const ebayJpy = parseFloat(document.getElementById("detail-ebay-jpy")?.value) || 0;
          const shippingJpy = parseFloat(document.getElementById("detail-shipping-jpy")?.value) || 0;
          const profitAmount = parseFloat(document.getElementById("detail-profit-amount")?.value) || 0;
          const discountPct = parseFloat(document.getElementById("detail-discount-pct")?.value) || 30;
          const maxPrice = parseFloat(document.getElementById("detail-max-price")?.value) || 0;
          const exclude = document.getElementById("detail-exclude")?.value?.trim() || "";
          const specsNote = document.getElementById("detail-specs-note")?.value || "";

          if (name && keyword && maxPrice > 0) {
            await fetch(`/api/targets/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name, keyword, category, ebay_jpy: ebayJpy, shipping_jpy: shippingJpy,
                profit_amount: profitAmount, discount_pct: discountPct, max_price: maxPrice,
                exclude_keywords: exclude, specs_note: specsNote
              })
            });
          }
        } catch (saveErr) {
          console.warn("Auto save target failed, proceeding to search:", saveErr);
        }

        // 2. まず一覧をクリア
        await fetch("/api/detections", { method: "DELETE" });

        // 3. この商品のチェック処理を実行
        const res = await fetch(`/api/targets/${id}/check?search_mode=${searchMode}`, { method: "POST" });
        const data = await res.json();
        showToast(`4モールから ${data.count} 件の【${modeLabel}】確定商品を検出！`, "success");
        await loadDetections();
        await loadTargets();
        
        // 4. この商品のピックアップ一覧画面へ遷移しヘッダー更新
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
        const tabDet = document.getElementById("tab-detections");
        if (tabDet) tabDet.classList.add("active");

        const pTitle = document.getElementById("page-title");
        if (pTitle) {
          pTitle.innerHTML = isAllMode 
            ? `🌐 全体網羅ピックアップ一覧 <span style="font-size:14px; font-weight:600; color:#38bdf8; background:#0b1322; padding:3px 8px; border-radius:6px; border:1px solid #38bdf8; margin-left:8px;">[${targetName}]</span>`
            : `⚡ 直近新着ピックアップ一覧 <span style="font-size:14px; font-weight:600; color:#34d399; background:#0b1322; padding:3px 8px; border-radius:6px; border:1px solid #34d399; margin-left:8px;">[${targetName}]</span>`;
        }
            
        const pDesc = document.getElementById("page-desc");
        if (pDesc) {
          pDesc.textContent = isAllMode
            ? `【🌐 全体（網羅）モード・仕入れ上限内】4モール全期間から検出された「${targetName}」の出品一覧`
            : `【⚡ 直近（新着）モード・仕入れ上限内】4モールの直近新着から検出された「${targetName}」の出品一覧`;
        }

        const feedModeSelect = document.getElementById("feed-search-mode-select");
        if (feedModeSelect) feedModeSelect.value = searchMode;

        const filterSelect = document.getElementById("filter-target");
        if (filterSelect) filterSelect.value = id;
        renderDetections(id);
      } catch (e) {
        console.error("Check now error:", e);
        showToast("チェックエラーが発生しました", "error");
      } finally {
        hideLoadingOverlay();
        btnCheckNow.textContent = "⚡ この商品をチェック";
      }
    });
  }

  // 🔍 商品全検索（上限価格なし・全期間の全出品を取得）
  const btnCheckAllPrices = document.getElementById("detail-btn-check-all-prices");
  if (btnCheckAllPrices) {
    btnCheckAllPrices.addEventListener("click", async () => {
      const id = document.getElementById("detail-item-id")?.value;
      const targetName = document.getElementById("detail-name")?.value || "選択商品";
      if (!id) return;

      btnCheckAllPrices.textContent = "⌛ 全件網羅検索中...";
      showLoadingOverlay(`🔍 「${targetName}」の上限なし全件取得中...`, "仕入れ上限価格制限なしで、4モールの過去出品・高額品を含むすべてのデータを網羅検索しています");
      showToast(`フォーム設定を最新状態に同期し、【🔍 上限なし全検索】で4モールを網羅取得中...`, "info");
      try {
        // 1. 最新のフォーム入力条件を自動保存（安全ガード付き）
        try {
          const name = document.getElementById("detail-name")?.value?.trim() || targetName;
          const keyword = document.getElementById("detail-keyword")?.value?.trim() || name;
          const catSelect = document.getElementById("detail-category-select");
          const category = catSelect ? catSelect.value : "📁 その他・未分類";
          const ebayJpy = parseFloat(document.getElementById("detail-ebay-jpy")?.value) || 0;
          const shippingJpy = parseFloat(document.getElementById("detail-shipping-jpy")?.value) || 0;
          const profitAmount = parseFloat(document.getElementById("detail-profit-amount")?.value) || 0;
          const discountPct = parseFloat(document.getElementById("detail-discount-pct")?.value) || 30;
          const maxPrice = parseFloat(document.getElementById("detail-max-price")?.value) || 0;
          const exclude = document.getElementById("detail-exclude")?.value?.trim() || "";
          const specsNote = document.getElementById("detail-specs-note")?.value || "";

          if (name && keyword && maxPrice > 0) {
            await fetch(`/api/targets/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name, keyword, category, ebay_jpy: ebayJpy, shipping_jpy: shippingJpy,
                profit_amount: profitAmount, discount_pct: discountPct, max_price: maxPrice,
                exclude_keywords: exclude, specs_note: specsNote
              })
            });
          }
        } catch (saveErr) {
          console.warn("Auto save target failed, proceeding to search:", saveErr);
        }

        // 2. まず一覧をクリア
        await fetch("/api/detections", { method: "DELETE" });

        // 3. 上限価格フィルターを解除＆全体モードで全件チェックを実行
        const res = await fetch(`/api/targets/${id}/check?search_mode=all&ignore_max_price=true`, { method: "POST" });
        const data = await res.json();
        showToast(`4モールから上限なしの全 ${data.count} 件を検出！`, "success");
        await loadDetections();
        await loadTargets();
        
        // 4. この商品のピックアップ一覧画面へ遷移し【🔍 商品全検索（上限なし）】ヘッダーを明示
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
        const tabDet = document.getElementById("tab-detections");
        if (tabDet) tabDet.classList.add("active");

        const pTitle = document.getElementById("page-title");
        if (pTitle) {
          pTitle.innerHTML = `🔍 商品全検索結果 (上限なし) <span style="font-size:14px; font-weight:700; color:#c084fc; background:rgba(168,85,247,0.15); padding:3px 10px; border-radius:6px; border:1px solid #a855f7; margin-left:8px;">[${targetName}]</span>`;
        }
        
        const pDesc = document.getElementById("page-desc");
        if (pDesc) {
          pDesc.textContent = `【🔍 商品全検索 (上限なし)】仕入れ上限価格フィルターを解除し、全価格帯・全期間から抽出した「${targetName}」の出品一覧`;
        }

        const feedModeSelect = document.getElementById("feed-search-mode-select");
        if (feedModeSelect) feedModeSelect.value = "all";

        const filterSelect = document.getElementById("filter-target");
        if (filterSelect) filterSelect.value = id;
        renderDetections(id);
      } catch (e) {
        console.error("Check all prices error:", e);
        showToast("全検索エラーが発生しました", "error");
      } finally {
        hideLoadingOverlay();
        btnCheckAllPrices.textContent = "🔍 商品全検索 (上限なし)";
      }
    });
  }

  // 詳細フォーム保存
  const detailForm = document.getElementById("form-detail-target");
  if (detailForm) {
    detailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("detail-item-id").value;
      if (!id) return;

      const name = document.getElementById("detail-name").value.trim();
      const keyword = document.getElementById("detail-keyword").value.trim();
      const catSelect = document.getElementById("detail-category-select");
      const category = catSelect ? catSelect.value : "📁 その他・未分類";
      const ebayJpy = parseFloat(document.getElementById("detail-ebay-jpy").value) || 0;
      const shippingJpy = parseFloat(document.getElementById("detail-shipping-jpy").value) || 0;
      const discountPct = parseFloat(document.getElementById("detail-discount-pct").value) || 30;
      const maxPrice = parseFloat(document.getElementById("detail-max-price").value) || 0;
      const exclude = document.getElementById("detail-exclude").value.trim();
      const specs = document.getElementById("detail-specs-note").value;

      const payload = {
        name,
        keyword,
        category,
        ebay_price_jpy: ebayJpy,
        ebay_price_usd: ebayJpy > 0 && currentRate > 0 ? parseFloat((ebayJpy / currentRate).toFixed(2)) : 0,
        est_shipping_jpy: shippingJpy,
        target_discount_pct: discountPct,
        max_buy_price_jpy: maxPrice,
        exclude_keywords: exclude,
        specs_note: specs
      };

      try {
        const res = await fetch(`/api/targets/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Update failed");
        showToast("💾 設定＆商品スペックを更新・保存しました！", "success");
        await loadTargets();
        const updated = targetItems.find(t => t.id == id);
        if (updated) openTargetDetail(updated);
      } catch (err) {
        showToast("保存エラーが発生しました", "error");
      }
    });
  }
}

// モーダル連動計算 (売上基準: (相場＋送料) − 利益額 − 手数料12% − 送料)
function setupModalCalculations() {
  const inputJpy = document.getElementById("input-ebay-jpy");
  const inputShipping = document.getElementById("input-shipping-jpy");
  const inputProfitAmount = document.getElementById("input-profit-amount");
  const inputProfitPct = document.getElementById("input-discount-pct");
  const inputMaxPrice = document.getElementById("input-max-price");
  const textCalcNet = document.getElementById("calc-ebay-net-text");
  const textDetail = document.getElementById("calc-detail-text");

  let isManualOverride = false;

  function updateCalc(source = "from_pct", forceAuto = false) {
    const itemPrice = parseFloat(inputJpy.value) || 0;
    const shipping = parseFloat(inputShipping ? inputShipping.value : 0) || 0;
    const feePct = 12.0;

    if (itemPrice > 0) {
      const totalCharged = itemPrice + shipping;
      const fee = totalCharged * (feePct / 100.0);
      const netPayout = totalCharged - fee - shipping;
      textCalcNet.textContent = `手数料${feePct}%: 約 ¥${Math.round(fee).toLocaleString()}`;
      
      let profitAmount = 0;
      let profitPct = 30;

      if (source === "from_amount" && inputProfitAmount) {
        profitAmount = parseFloat(inputProfitAmount.value) || 0;
        profitPct = (profitAmount / itemPrice) * 100;
        inputProfitPct.value = profitPct.toFixed(1);
      } else {
        profitPct = parseFloat(inputProfitPct.value) || 30;
        profitAmount = Math.round(itemPrice * (profitPct / 100.0));
        if (inputProfitAmount) inputProfitAmount.value = profitAmount;
      }

      // 上限 ＝ 実質手取り − 利益額
      const maxPrice = Math.max(0, Math.round(netPayout - profitAmount));
      
      if (!isManualOverride || forceAuto) {
        inputMaxPrice.value = maxPrice;
      }
      
      if (shipping > 0) {
        textDetail.textContent = `💡 総売上 ¥${Math.round(totalCharged).toLocaleString()} (送料¥${Math.round(shipping).toLocaleString()}込) − 手数料12% ¥${Math.round(fee).toLocaleString()} − 送料 ¥${Math.round(shipping).toLocaleString()} − 利益 ¥${Math.round(profitAmount).toLocaleString()} (${profitPct.toFixed(1)}%) ＝ 上限 ¥${maxPrice.toLocaleString()}`;
      } else {
        textDetail.textContent = `💡 手取り ¥${Math.round(netPayout).toLocaleString()} − 利益 ¥${Math.round(profitAmount).toLocaleString()} (${profitPct.toFixed(1)}%) ＝ 上限 ¥${maxPrice.toLocaleString()}`;
      }
    } else {
      textCalcNet.textContent = `手数料12%: 約 ¥0`;
      if (inputProfitAmount) inputProfitAmount.value = "";
      if (!isManualOverride) inputMaxPrice.value = "";
      textDetail.textContent = `※ (相場＋送料) − 利益額 − 手数料12% − 送料 で自動計算されます`;
    }
  }

  inputJpy.addEventListener("input", () => {
    isManualOverride = false;
    updateCalc("from_pct", true);
  });

  if (inputShipping) {
    inputShipping.addEventListener("input", () => {
      isManualOverride = false;
      updateCalc("from_pct", true);
    });
  }
  
  inputProfitPct.addEventListener("input", () => {
    isManualOverride = false;
    updateCalc("from_pct", true);
  });

  if (inputProfitAmount) {
    inputProfitAmount.addEventListener("input", () => {
      isManualOverride = false;
      updateCalc("from_amount", true);
    });
  }

  inputMaxPrice.addEventListener("input", () => {
    isManualOverride = true;
  });
}

// イベントリスナーの初期化
function initEvents() {
  // タブ切り替え
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      document.querySelectorAll(".sidebar-subitem").forEach(si => si.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const targetTab = document.getElementById(tabId);
      if (targetTab) targetTab.classList.add("active");

      // タイトル更新
      if (tabId === "tab-detections") {
        document.getElementById("page-title").textContent = "新着・検知フィード";
        document.getElementById("page-desc").textContent = "eBay相場より2割以上安い仕入れチャンス商品を自動検知中";
      } else if (tabId === "tab-targets") {
        document.getElementById("page-title").textContent = "🎯 登録商品リスト (全体一覧)";
        document.getElementById("page-desc").textContent = "登録中の全商品・検索キーワード・除外条件・仕入れ上限価格一覧";
      } else if (tabId === "tab-delist") {
        document.getElementById("page-title").textContent = "📦 eBay自動取り下げ (Google Sheet連携)";
        document.getElementById("page-desc").textContent = "仕入れ元の売り切れ・削除を自動検知してeBayから自動取り下げ";
        loadDelistItemsAndSettings();
      } else if (tabId === "tab-settings") {
        document.getElementById("page-title").textContent = "システム設定 & 通知連携";
        document.getElementById("page-desc").textContent = "Discord Webhookや為替レート、利益計算ルールの設定";
      }
    });
  });

  // 一覧クリアボタン
  const clearBtn = document.getElementById("btn-clear-detections");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (!confirm("現在のピックアップ一覧をすべてクリア（リセット）しますか？\n（※⭐キープ保存した商品は保護されます）")) return;
      try {
        // 1. 即座に画面カードをクリア（即時反映）
        detections = detections.filter(d => d.is_saved === 1 || d.is_saved === true);
        renderDetections();
        
        // 2. サーバーへリセット要求
        await fetch("/api/detections", { method: "DELETE" });
        showToast("ピックアップ一覧をリセットしました", "info");
        await loadDetections(true);
      } catch (e) {
        showToast("クリアエラー", "error");
      }
    });
  }

  // アラート音トグル
  document.getElementById("btn-audio-toggle").addEventListener("click", () => {
    soundAlertEnabled = !soundAlertEnabled;
    const icon = document.getElementById("audio-icon");
    const txt = document.getElementById("audio-status-text");
    if (soundAlertEnabled) {
      icon.textContent = "🔊";
      txt.textContent = "アラート音: ON";
      playAlertSound();
    } else {
      icon.textContent = "🔇";
      txt.textContent = "アラート音: OFF";
    }
  });

  // 為替更新ボタン
  document.getElementById("btn-refresh-rate").addEventListener("click", async () => {
    const btn = document.getElementById("btn-refresh-rate");
    btn.textContent = "⌛";
    try {
      const res = await fetch("/api/exchange-rate/refresh", { method: "POST" });
      const data = await res.json();
      currentUsdJpyRate = data.usd_jpy_rate;
      document.getElementById("current-usd-jpy").textContent = `¥${currentUsdJpyRate.toFixed(2)}`;
      showToast(`為替レートを更新しました: 1 USD = ¥${currentUsdJpyRate.toFixed(2)}`, "success");
    } catch (e) {
      showToast("為替レート取得失敗", "error");
    } finally {
      btn.textContent = "🔄";
    }
  });

  // 全体チェックボタン
  document.getElementById("btn-check-all").addEventListener("click", async () => {
    const btn = document.getElementById("btn-check-all");
    btn.innerHTML = "<span>⌛</span> チェック中...";
    btn.disabled = true;
    showLoadingOverlay("⚡ 全商品を一括チェック中...", "登録されているすべての商品の最新出品データを4モール（メルカリ・ヤフオク・ヤフーフリマ・ラクマ）から自動抽出しています");
    try {
      for (const item of targetItems) {
        if (item.is_active) {
          await fetch(`/api/targets/${item.id}/check`, { method: "POST" });
        }
      }
      showToast("すべての監視対象をチェックしました！", "success");
      await loadDetections();
      await loadTargets();
    } catch (e) {
      showToast("巡回エラーが発生しました", "error");
    } finally {
      hideLoadingOverlay();
      btn.innerHTML = "<span>⚡</span> すべて今すぐピックアップ";
      btn.disabled = false;
    }
  });

  // サンプルデータ登録
  const seedBtn = document.getElementById("btn-seed-samples");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.disabled = true;
      seedBtn.textContent = "登録中...";
      try {
        await fetch("/api/seed-samples", { method: "POST" });
        showToast("売れ筋サンプル監視（3DS, PS Vita, IXY）を追加しました！", "success");
        await loadTargets();
        document.querySelector('[data-tab="tab-targets"]').click();
      } catch (e) {
        showToast("登録エラー", "error");
      }
    });
  }

  // モーダル開閉
  const modal = document.getElementById("add-modal");
  document.getElementById("btn-open-add-modal").addEventListener("click", () => {
    // 新規登録モードとしてリセット
    document.getElementById("edit-target-id").value = "";
    document.getElementById("modal-title").textContent = "🎯 監視対象商品の追加";
    document.getElementById("btn-submit-target").textContent = "🚀 監視を開始する";
    document.getElementById("form-add-target").reset();
    document.getElementById("calc-ebay-net-text").textContent = "手数料12%: 約 ¥0";
    document.getElementById("calc-detail-text").textContent = "※ (相場＋送料) − 利益額 − 手数料12% − 送料 で自動計算されます";
    modal.classList.add("open");
  });
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    modal.classList.remove("open");
  });
  document.getElementById("btn-cancel-modal").addEventListener("click", () => {
    modal.classList.remove("open");
  });

  // 監視登録・編集フォーム送信
  document.getElementById("form-add-target").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = document.getElementById("edit-target-id").value;
    const jpy = parseFloat(document.getElementById("input-ebay-jpy").value) || 0;
    const shippingJpy = parseFloat(document.getElementById("input-shipping-jpy").value) || 0;
    const profitRate = parseFloat(document.getElementById("input-discount-pct").value) || 30;
    let maxPrice = parseFloat(document.getElementById("input-max-price").value) || 0;
    const usd = currentUsdJpyRate > 0 ? (jpy / currentUsdJpyRate) : 0;
    
    // もし上限価格が未入力の場合は逆算値（(相場+送料) - 手数料12% - 送料 - 利益額）を自動補完
    if (maxPrice <= 0 && jpy > 0) {
      const totalCharged = jpy + shippingJpy;
      const fee = totalCharged * 0.12;
      const profitAmount = jpy * (profitRate / 100.0);
      maxPrice = Math.max(0, Math.round(totalCharged - fee - shippingJpy - profitAmount));
    }

    const inputCatSelect = document.getElementById("input-category-select");
    const category = inputCatSelect ? inputCatSelect.value : "📁 その他・未分類";

    const payload = {
      name: document.getElementById("input-name").value.trim(),
      keyword: document.getElementById("input-keyword").value.trim(),
      category: category,
      platform: "all",
      ebay_price_usd: Math.round(usd * 100) / 100,
      ebay_price_jpy: jpy,
      est_shipping_jpy: shippingJpy,
      target_discount_pct: profitRate,
      max_buy_price_jpy: maxPrice,
      min_profit_jpy: 0,
      exclude_keywords: document.getElementById("input-exclude").value.trim(),
      check_interval_seconds: 60,
      is_active: 1
    };

    try {
      if (editId) {
        // 更新 (PUT)
        const res = await fetch(`/api/targets/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast(`「${payload.name}」の設定を更新しました！`, "success");
          modal.classList.remove("open");
          await loadTargets();
        }
      } else {
        // 新規登録 (POST)
        const res = await fetch("/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast(`「${payload.name}」の監視を開始しました！`, "success");
          modal.classList.remove("open");
          await loadTargets();
          document.querySelector('[data-tab="tab-targets"]').click();
        }
      }
    } catch (e) {
      showToast("保存エラー", "error");
    }
  });

  // 並び替え & 絞り込み & リフレッシュ (フィード)
  document.getElementById("sort-detections").addEventListener("change", () => renderDetections());
  document.getElementById("filter-target").addEventListener("change", (e) => {
    renderDetections();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'TARGET_ITEM_SELECTED', targetId: e.target.value }, '*');
    }
  });
  document.getElementById("btn-refresh-detections").addEventListener("click", () => loadDetections());



  // 🎯 登録商品リストの並び替え & カテゴリー絞り込み
  const sortTargetsEl = document.getElementById("sort-targets");
  if (sortTargetsEl) {
    sortTargetsEl.addEventListener("change", renderTargetsTable);
  }
  const filterCatEl = document.getElementById("filter-target-category");
  if (filterCatEl) {
    filterCatEl.addEventListener("change", renderTargetsTable);
  }

  // 設定タブ: 設定ロードと保存
  loadSettings();

  document.getElementById("btn-save-settings").addEventListener("click", async () => {
    const url = document.getElementById("setting-discord-url").value.trim();
    const enabled = document.getElementById("setting-discord-enabled").checked ? "1" : "0";
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discord_webhook_url: url,
          discord_enabled: enabled
        })
      });
      showToast("Discord設定を保存しました", "success");
    } catch (e) {
      showToast("保存エラー", "error");
    }
  });

  document.getElementById("btn-test-discord").addEventListener("click", async () => {
    const url = document.getElementById("setting-discord-url").value.trim();
    if (!url) {
      showToast("Discord Webhook URLを入力してください", "error");
      return;
    }
    const btn = document.getElementById("btn-test-discord");
    btn.textContent = "送信中...";
    try {
      const res = await fetch("/api/settings/test-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: url })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Discordにテスト通知を送信しました！確認してください。", "success");
      } else {
        showToast(data.detail || "送信に失敗しました", "error");
      }
    } catch (e) {
      showToast("Discord送信エラー", "error");
    } finally {
      btn.textContent = "📨 テスト通知を送信";
    }
  });

  document.getElementById("btn-save-calc-settings").addEventListener("click", async () => {
    const fee = document.getElementById("setting-ebay-fee").value;
    const rate = document.getElementById("setting-usd-rate").value;
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ebay_fee_pct: fee,
          usd_jpy_rate: rate
        })
      });
      showToast("計算設定を保存しました", "success");
      loadStatusAndRate();
    } catch (e) {
      showToast("保存エラー", "error");
    }
  });

  // ⭐ お気に入り（保存済み）のみ表示チェックボックス
  const savedFilterEl = document.getElementById("filter-saved-only");
  if (savedFilterEl) {
    savedFilterEl.addEventListener("change", () => {
      if (savedFilterEl.checked) {
        const hiddenEl = document.getElementById("filter-hidden-only");
        if (hiddenEl && hiddenEl.checked) {
          hiddenEl.checked = false;
          loadDetections(true);
          return;
        }
      }
      renderDetections();
    });
  }

  // 📦 出品中のみ表示チェックボックス
  const listingFilterEl = document.getElementById("filter-listing-only");
  if (listingFilterEl) {
    listingFilterEl.addEventListener("change", () => {
      if (listingFilterEl.checked) {
        const hiddenEl = document.getElementById("filter-hidden-only");
        if (hiddenEl && hiddenEl.checked) {
          hiddenEl.checked = false;
          loadDetections(true);
          return;
        }
      }
      renderDetections();
    });
  }

  // 🚫 非表示リストのみ表示チェックボックス
  const hiddenFilterEl = document.getElementById("filter-hidden-only");
  if (hiddenFilterEl) {
    hiddenFilterEl.addEventListener("change", async () => {
      if (hiddenFilterEl.checked) {
        const savedEl = document.getElementById("filter-saved-only");
        if (savedEl) savedEl.checked = false;
        showToast("🚫 非表示リストを読み込みました", "info");
      } else {
        showToast("⚡ 通常のピックアップ一覧に戻りました", "info");
      }
      await loadDetections(true);
    });
  }

  // 🌐 eBay販売実績を見るボタン
  const ebaySoldBtn = document.getElementById("btn-open-ebay-sold");
  if (ebaySoldBtn) {
    ebaySoldBtn.addEventListener("click", () => {
      const filterSelect = document.getElementById("filter-target");
      const selectedVal = filterSelect ? filterSelect.value : "all";
      let searchKw = "";
      
      if (selectedVal !== "all") {
        const target = targetItems.find(t => String(t.id) === String(selectedVal));
        if (target) {
          searchKw = target.keyword || target.name;
        }
      }
      
      // 選択がない場合は、現在表示中の最初のカード、または登録商品の先頭
      if (!searchKw) {
        if (detections && detections.length > 0) {
          const firstDet = detections[0];
          const t = targetItems.find(t => t.id === firstDet.target_item_id);
          searchKw = t ? (t.keyword || t.name) : firstDet.target_name;
        } else if (targetItems && targetItems.length > 0) {
          searchKw = targetItems[0].keyword || targetItems[0].name;
        }
      }

      if (!searchKw) {
        showToast("検索対象の商品がありません", "warning");
        return;
      }

      const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchKw)}&LH_Sold=1&LH_Complete=1`;
      window.open(ebayUrl, "_blank");
    });
  }

  // ⚡ ヘッダーの「この商品をチェック」ボタン
  const feedCheckNowBtn = document.getElementById("btn-feed-check-now");
  if (feedCheckNowBtn) {
    feedCheckNowBtn.addEventListener("click", async () => {
      const filterSelect = document.getElementById("filter-target");
      const selectedVal = filterSelect ? filterSelect.value : "all";
      let target = null;
      if (selectedVal !== "all") {
        target = targetItems.find(t => String(t.id) === String(selectedVal));
      }
      if (!target) {
        showToast("対象の商品を選択してください", "warning");
        return;
      }
      const modeSelect = document.getElementById("feed-search-mode-select");
      const searchMode = modeSelect ? modeSelect.value : "recent";
      const isAllMode = searchMode === "all";
      const modeLabel = isAllMode ? "全体（網羅）" : "直近（新着）";

      feedCheckNowBtn.textContent = "⌛ 検索中...";
      showLoadingOverlay(`⚡ 「${target.name}」を4モール【${modeLabel}】取得中...`, "メルカリ・ヤフオク・ヤフーフリマ・ラクマから最新の仕入れ可能商品を自動抽出しています");
      showToast(`一覧をリセットし、「${target.name}」を4モール【${modeLabel}】検索中...`, "info");
      try {
        await fetch("/api/detections", { method: "DELETE" });
        const res = await fetch(`/api/targets/${target.id}/check?search_mode=${searchMode}`, { method: "POST" });
        const data = await res.json();
        showToast(`4モールから ${data.count} 件の【${modeLabel}】確定商品を検出！`, "success");
        await loadDetections();
        await loadTargets();

        document.getElementById("page-title").innerHTML = isAllMode 
          ? `🌐 全体網羅ピックアップ一覧 <span style="font-size:14px; font-weight:600; color:#38bdf8; background:#0b1322; padding:3px 8px; border-radius:6px; border:1px solid #38bdf8; margin-left:8px;">[${target.name}]</span>`
          : `⚡ 直近新着ピックアップ一覧 <span style="font-size:14px; font-weight:600; color:#34d399; background:#0b1322; padding:3px 8px; border-radius:6px; border:1px solid #34d399; margin-left:8px;">[${target.name}]</span>`;
          
        document.getElementById("page-desc").textContent = isAllMode
          ? `【🌐 全体（網羅）モード・仕入れ上限内】4モール全期間から検出された「${target.name}」の出品一覧`
          : `【⚡ 直近（新着）モード・仕入れ上限内】4モールの直近新着から検出された「${target.name}」の出品一覧`;

        renderDetections(target.id);
      } catch (e) {
        showToast("チェックエラーが発生しました", "error");
      } finally {
        hideLoadingOverlay();
        feedCheckNowBtn.textContent = "⚡ この商品をチェック";
      }
    });
  }

  // 🔍 ヘッダーの「商品全検索 (上限なし)」ボタン
  const feedCheckAllPricesBtn = document.getElementById("btn-feed-check-all-prices");
  if (feedCheckAllPricesBtn) {
    feedCheckAllPricesBtn.addEventListener("click", async () => {
      const filterSelect = document.getElementById("filter-target");
      const selectedVal = filterSelect ? filterSelect.value : "all";
      let target = null;
      if (selectedVal !== "all") {
        target = targetItems.find(t => String(t.id) === String(selectedVal));
      }
      if (!target) {
        showToast("対象の商品を選択してください", "warning");
        return;
      }

      feedCheckAllPricesBtn.textContent = "⌛ 網羅検索中...";
      showLoadingOverlay(`🔍 「${target.name}」の上限なし全件取得中...`, "仕入れ上限価格制限なしで、4モールの過去出品・高額品を含むすべてのデータを網羅検索しています");
      showToast(`「${target.name}」の上限なし全価格帯出品を4モールから取得中...`, "info");
      try {
        await fetch("/api/detections", { method: "DELETE" });
        const res = await fetch(`/api/targets/${target.id}/check?search_mode=all&ignore_max_price=true`, { method: "POST" });
        const data = await res.json();
        showToast(`4モールから上限なしの全 ${data.count} 件の出品を検出！`, "success");
        await loadDetections();
        await loadTargets();

        document.getElementById("page-title").innerHTML = `🔍 商品全検索結果 (上限なし) <span style="font-size:14px; font-weight:700; color:#c084fc; background:rgba(168,85,247,0.15); padding:3px 10px; border-radius:6px; border:1px solid #a855f7; margin-left:8px;">[${target.name}]</span>`;
        document.getElementById("page-desc").textContent = `【🔍 商品全検索 (上限なし)】仕入れ上限価格フィルターを解除し、全価格帯・全期間から抽出した「${target.name}」の出品一覧`;

        const feedModeSelect = document.getElementById("feed-search-mode-select");
        if (feedModeSelect) feedModeSelect.value = "all";

        renderDetections(target.id);
      } catch (e) {
        showToast("全検索エラーが発生しました", "error");
      } finally {
        hideLoadingOverlay();
        feedCheckAllPricesBtn.textContent = "🔍 商品全検索 (上限なし)";
      }
    });
  }

  // ⚙️ ヘッダーの「条件を編集」ボタン
  const editTargetBtn = document.getElementById("btn-edit-current-target");
  if (editTargetBtn) {
    editTargetBtn.addEventListener("click", () => {
      const filterSelect = document.getElementById("filter-target");
      const selectedVal = filterSelect ? filterSelect.value : "all";
      let target = null;
      if (selectedVal !== "all") {
        target = targetItems.find(t => String(t.id) === String(selectedVal));
      }
      if (!target) {
        showToast("対象の商品を選択してください", "warning");
        return;
      }
      if (target) {
        openTargetDetail(target);
      } else {
        showToast("編集する商品が選択されていません", "warning");
      }
    });
  }

  // 🌐 モーダル内の「eBay販売実績を調べる」ボタン
  const modalEbayBtn = document.getElementById("btn-modal-open-ebay-sold");
  if (modalEbayBtn) {
    modalEbayBtn.addEventListener("click", () => {
      const kw = document.getElementById("input-keyword")?.value.trim() || document.getElementById("input-name")?.value.trim() || "";
      if (!kw) {
        showToast("「商品名」または「国内検索キーワード」を先に入力してください", "warning");
        return;
      }
      const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(kw)}&LH_Sold=1&LH_Complete=1`;
      window.open(ebayUrl, "_blank");
    });
  }

  // 🌐 詳細マスター画面の「eBay販売実績を調べる」ボタン
  const detailEbayBtn = document.getElementById("btn-detail-open-ebay-sold");
  if (detailEbayBtn) {
    detailEbayBtn.addEventListener("click", () => {
      const kw = document.getElementById("detail-keyword")?.value.trim() || document.getElementById("detail-name")?.value.trim() || "";
      if (!kw) {
        showToast("「商品名」または「検索キーワード」を入力してください", "warning");
        return;
      }
      const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(kw)}&LH_Sold=1&LH_Complete=1`;
      window.open(ebayUrl, "_blank");
    });
  }
}

// ⭐ 商品保存（キープ）トグル関数
async function toggleSaveItem(detectionId, cardElement = null) {
  const item = detections.find(d => d.id === detectionId);
  if (!item) return;

  const newSavedState = item.is_saved === 1 ? 0 : 1;
  item.is_saved = newSavedState; // 楽観的更新

  // カード要素が渡されている場合、DOMを即座にスムーズ更新
  if (cardElement) {
    const saveBtn = cardElement.querySelector('.btn-save-item');
    const hideBtn = cardElement.querySelector('.btn-hide-item');
    const imgWrap = cardElement.querySelector('.card-img-wrap');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.toggle('is-saved', newSavedState === 1);
      saveBtn.innerHTML = newSavedState === 1 ? '⭐' : '☆';
      saveBtn.title = newSavedState === 1 ? '⭐ 保存中（クリックで解除）' : '☆ クリックで保存';
    }
    if (hideBtn) {
      const shouldHide = (newSavedState === 1) || (item.is_listing === 1 || item.is_listing === true);
      hideBtn.style.display = shouldHide ? 'none' : '';
    }
    if (imgWrap) {
      let badge = imgWrap.querySelector('.saved-badge');
      if (newSavedState === 1 && !badge) {
        badge = document.createElement('span');
        badge.className = 'saved-badge';
        badge.textContent = '⭐ キープ';
        imgWrap.appendChild(badge);
      } else if (newSavedState === 0 && badge) {
        badge.remove();
      }
    }
  }

  // 「保存済みのみ表示」フィルターが有効な場合は一覧を再絞り込み
  const savedFilterEl = document.getElementById("filter-saved-only");
  if (savedFilterEl && savedFilterEl.checked) {
    renderDetections();
  }

  try {
    const res = await fetch(`/api/detections/${detectionId}/toggle_save`, {
      method: "POST"
    });
    if (res.ok) {
      const data = await res.json();
      item.is_saved = data.is_saved;
      if (data.is_saved === 1) {
        showToast("⭐ 商品をキープ保存しました（クリアしても保護されます）", "success");
      } else {
        showToast("キープ保存を解除しました", "info");
      }
    }
  } catch (e) {
    console.error("Failed to toggle save:", e);
    // ロールバック
    item.is_saved = newSavedState === 1 ? 0 : 1;
    renderDetections();
    showToast("保存状態の変更に失敗しました", "error");
  } finally {
    if (cardElement) {
      const saveBtn = cardElement.querySelector('.btn-save-item');
      if (saveBtn) saveBtn.disabled = false;
    }
  }
}

// 📦 商品出品中ステータストグル関数
async function toggleListingItem(detectionId, cardElement = null) {
  const item = detections.find(d => d.id === detectionId);
  if (!item) return;

  const newListingState = item.is_listing === 1 ? 0 : 1;
  item.is_listing = newListingState;

  // カード要素が渡されている場合、DOMを即座にスムーズ更新
  if (cardElement) {
    const listingBtn = cardElement.querySelector('.btn-listing-item');
    const hideBtn = cardElement.querySelector('.btn-hide-item');
    if (listingBtn) {
      listingBtn.disabled = true;
      listingBtn.classList.toggle('is-listing', newListingState === 1);
      listingBtn.innerHTML = newListingState === 1 ? '🚀' : '📦';
      listingBtn.title = newListingState === 1 ? '🚀 出品中（クリックで解除）' : '📦 出品中に設定';
    }
    if (hideBtn) {
      const shouldHide = (newListingState === 1) || (item.is_saved === 1 || item.is_saved === true);
      hideBtn.style.display = shouldHide ? 'none' : '';
    }
    cardElement.classList.toggle('is-listing-card', newListingState === 1);
    
    // ステータスタグの更新
    const targetNameWrap = cardElement.querySelector('.card-body div:first-child div:first-child');
    if (targetNameWrap) {
      let lBadge = targetNameWrap.querySelector('.listing-badge');
      if (newListingState === 1 && !lBadge) {
        lBadge = document.createElement('span');
        lBadge.className = 'listing-badge';
        lBadge.textContent = '🚀 出品中';
        targetNameWrap.insertBefore(lBadge, targetNameWrap.children[1] || null);
      } else if (newListingState === 0 && lBadge) {
        lBadge.remove();
      }
    }
  }

  // 「出品中のみ表示」フィルターが有効な場合は一覧を再絞り込み
  const listingFilterEl = document.getElementById("filter-listing-only");
  if (listingFilterEl && listingFilterEl.checked) {
    renderDetections();
  }

  try {
    const res = await fetch(`/api/detections/${detectionId}/toggle_listing`, {
      method: "POST"
    });
    if (res.ok) {
      const data = await res.json();
      item.is_listing = data.is_listing;
      if (data.is_listing === 1) {
        showToast("🚀 商品を「出品中」に設定しました！（クリアしても保護されます）", "success");
      } else {
        showToast("「出品中」ステータスを解除しました", "info");
      }
    }
  } catch (e) {
    console.error("Failed to toggle listing:", e);
    // ロールバック
    item.is_listing = newListingState === 1 ? 0 : 1;
    renderDetections();
    showToast("出品中ステータスの変更に失敗しました", "error");
  } finally {
    if (cardElement) {
      const listingBtn = cardElement.querySelector('.btn-listing-item');
      if (listingBtn) listingBtn.disabled = false;
    }
  }
}

// 🚫 商品非表示（もう見ない）トグル関数
async function toggleHideItem(detectionId, cardElement = null) {
  const item = detections.find(d => d.id === detectionId);
  if (!item) return;

  const newHiddenState = item.is_hidden === 1 ? 0 : 1;
  item.is_hidden = newHiddenState;

  // 現在の画面リストから即座に除外
  detections = detections.filter(d => d.id !== detectionId);

  // カードをスムーズにフェードアウト縮小して消去
  if (cardElement) {
    cardElement.classList.add('card-hiding');
    setTimeout(() => {
      cardElement.remove();
      // 残り枚数チェック
      const remaining = document.querySelectorAll('.detection-card');
      if (remaining.length === 0) {
        const empty = document.getElementById("detections-empty");
        if (empty) empty.style.display = "block";
      }
    }, 260);
  }

  try {
    const res = await fetch(`/api/detections/${detectionId}/toggle_hide`, {
      method: "POST"
    });
    if (res.ok) {
      const data = await res.json();
      if (data.is_hidden === 1) {
        showToast("🚫 商品を非表示にしました（再検索時も自動除外されます）", "info");
      } else {
        showToast("↩️ 商品を通常一覧に復元しました", "success");
      }
    }
  } catch (e) {
    console.error("Failed to toggle hide:", e);
    loadDetections();
    showToast("非表示の切り替えに失敗しました", "error");
  }
}

// 👀 直近閲覧（前回確認した最新1件のみ）マーク更新関数
let lastViewedItemId = localStorage.getItem("ebay_last_viewed_id") || null;

function markItemAsLastViewed(detectionId, cardElement = null) {
  lastViewedItemId = String(detectionId);
  localStorage.setItem("ebay_last_viewed_id", String(detectionId));

  // 他のすべてのカードから直前確認マーク・ハイライトを削除
  document.querySelectorAll('.detection-card').forEach(c => {
    c.classList.remove('last-viewed-card');
    const badge = c.querySelector('.last-viewed-badge');
    if (badge) badge.remove();
  });

  // 今回クリックした最新の1カードのみに「👀 直前に確認」を付与
  if (cardElement) {
    cardElement.classList.add('last-viewed-card');
    const imgWrap = cardElement.querySelector('.card-img-wrap');
    if (imgWrap && !imgWrap.querySelector('.last-viewed-badge')) {
      const badge = document.createElement('span');
      badge.className = 'last-viewed-badge';
      badge.textContent = '👀 直前に確認';
      imgWrap.appendChild(badge);
    }
  }
}

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const s = await res.json();
      if (s.discord_webhook_url) document.getElementById("setting-discord-url").value = s.discord_webhook_url;
      if (s.discord_enabled) document.getElementById("setting-discord-enabled").checked = s.discord_enabled === "1";
      if (s.ebay_fee_pct) document.getElementById("setting-ebay-fee").value = s.ebay_fee_pct;
      if (s.usd_jpy_rate) document.getElementById("setting-usd-rate").value = s.usd_jpy_rate;
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

// 📦 eBay 自動取り下げ機能のハンドラー ＆ レンダリング
async function loadDelistItemsAndSettings() {
  try {
    const [resItems, resSettings] = await Promise.all([
      fetch("/api/ebay/delist-items"),
      fetch("/api/settings")
    ]);
    if (resSettings.ok) {
      const s = await resSettings.json();
      if (s.google_sheet_url && document.getElementById("setting-sheet-url")) document.getElementById("setting-sheet-url").value = s.google_sheet_url;
      if (s.ebay_app_id && document.getElementById("setting-ebay-appid")) document.getElementById("setting-ebay-appid").value = s.ebay_app_id;
      if (s.ebay_dev_id && document.getElementById("setting-ebay-devid")) document.getElementById("setting-ebay-devid").value = s.ebay_dev_id;
      if (s.ebay_cert_id && document.getElementById("setting-ebay-certid")) document.getElementById("setting-ebay-certid").value = s.ebay_cert_id;
      if (s.ebay_user_token && document.getElementById("setting-ebay-token")) document.getElementById("setting-ebay-token").value = s.ebay_user_token;
      if (s.ebay_delist_mode && document.getElementById("setting-ebay-delist-mode")) document.getElementById("setting-ebay-delist-mode").value = s.ebay_delist_mode;
    }
    if (resItems.ok) {
      const items = await resItems.json();
      renderDelistTable(items);
    }
  } catch (e) {
    console.error("Delist items load error:", e);
  }
}

function renderDelistTable(items) {
  const tbody = document.getElementById("delist-items-table-body");
  if (!tbody) return;
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-dim);">登録済みのアイテムがありません。Googleスプレッドシートを同期するか、上のフォームから追加してください。</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(item => {
    const statusBadge = item.status === 'delisted' 
      ? `<span class="badge-status" style="background:#ef4444; color:#fff;">🛑 取り下げ完了</span>`
      : item.status === 'error'
      ? `<span class="badge-status" style="background:#f59e0b; color:#fff;">⚠️ エラー</span>`
      : `<span class="badge-status active">● 監視中</span>`;

    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #233044; font-family: var(--font-mono); font-weight: 600;">${item.ebay_item_id}</td>
        <td style="padding: 10px; border-bottom: 1px solid #233044; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <a href="${item.source_url}" target="_blank" style="color: #38bdf8; text-decoration: none;">${item.source_url}</a>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #233044;">${statusBadge}</td>
        <td style="padding: 10px; border-bottom: 1px solid #233044; font-size: 11px; color: var(--text-dim);">${item.last_checked_at || '未実行'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #233044; font-size: 11px;">${item.error_message || item.title || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #233044; text-align: center;">
          <button class="btn btn-secondary" onclick="deleteDelistItem(${item.id})" style="padding: 2px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);">削除</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteDelistItem(id) {
  if (!confirm("この監視アイテムを削除しますか？")) return;
  try {
    const res = await fetch(`/api/ebay/delist-items/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("監視アイテムを削除しました", "info");
      loadDelistItemsAndSettings();
    }
  } catch (e) {
    showToast("削除エラー", "error");
  }
}

function setupDelistHandlers() {
  const saveSheetBtn = document.getElementById("btn-save-sheet-url");
  if (saveSheetBtn) {
    saveSheetBtn.addEventListener("click", async () => {
      const sheetUrl = document.getElementById("setting-sheet-url")?.value.trim() || "";
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ google_sheet_url: sheetUrl })
        });
        showToast("GoogleスプレッドシートURLを保存しました", "success");
      } catch (e) {
        showToast("保存エラー", "error");
      }
    });
  }

  const syncSheetBtn = document.getElementById("btn-sync-sheet-now");
  if (syncSheetBtn) {
    syncSheetBtn.addEventListener("click", async () => {
      const sheetUrl = document.getElementById("setting-sheet-url")?.value.trim() || "";
      if (!sheetUrl) {
        showToast("GoogleスプレッドシートURLを入力してください", "warning");
        return;
      }
      syncSheetBtn.textContent = "⌛ 同期中...";
      syncSheetBtn.disabled = true;
      try {
        const res = await fetch("/api/ebay/sync-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ google_sheet_url: sheetUrl })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || "スプレッドシートから同期完了！", "success");
          loadDelistItemsAndSettings();
        } else {
          showToast(data.detail || "同期に失敗しました", "error");
        }
      } catch (e) {
        showToast("スプレッドシート同期エラー", "error");
      } finally {
        syncSheetBtn.textContent = "🔄 今すぐスプレッドシートから同期";
        syncSheetBtn.disabled = false;
      }
    });
  }

  const toggleCertBtn = document.getElementById("btn-toggle-certid-visibility");
  if (toggleCertBtn) {
    toggleCertBtn.addEventListener("click", () => {
      const input = document.getElementById("setting-ebay-certid");
      if (input) {
        if (input.type === "password") {
          input.type = "text";
          toggleCertBtn.textContent = "🔒";
        } else {
          input.type = "password";
          toggleCertBtn.textContent = "👁️";
        }
      }
    });
  }

  const saveEbayKeysBtn = document.getElementById("btn-save-ebay-keys");
  if (saveEbayKeysBtn) {
    saveEbayKeysBtn.addEventListener("click", async () => {
      const payload = {
        ebay_app_id: document.getElementById("setting-ebay-appid")?.value.trim() || "",
        ebay_dev_id: document.getElementById("setting-ebay-devid")?.value.trim() || "",
        ebay_cert_id: document.getElementById("setting-ebay-certid")?.value.trim() || "",
        ebay_user_token: document.getElementById("setting-ebay-token")?.value.trim() || "",
        ebay_delist_mode: document.getElementById("setting-ebay-delist-mode")?.value || "end_item"
      };
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        showToast("eBay API設定を保存しました！", "success");
      } catch (e) {
        showToast("保存エラー", "error");
      }
    });
  }

  const toggleAddBtn = document.getElementById("btn-toggle-add-delist-form");
  if (toggleAddBtn) {
    toggleAddBtn.addEventListener("click", () => {
      const formWrap = document.getElementById("delist-add-form-wrap");
      if (formWrap) {
        formWrap.style.display = formWrap.style.display === "none" ? "block" : "none";
      }
    });
  }

  const submitDelistItemBtn = document.getElementById("btn-submit-delist-item");
  if (submitDelistItemBtn) {
    submitDelistItemBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const ebayId = document.getElementById("input-delist-ebay-id")?.value.trim() || "";
      const sourceUrl = document.getElementById("input-delist-source-url")?.value.trim() || "";
      if (!ebayId || !sourceUrl) {
        showToast("eBay Item ID と仕入れ元URLを入力してください", "warning");
        return;
      }
      try {
        const res = await fetch("/api/ebay/delist-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ebay_item_id: ebayId, source_url: sourceUrl })
        });
        if (res.ok) {
          showToast("監視アイテムを追加しました！", "success");
          document.getElementById("input-delist-ebay-id").value = "";
          document.getElementById("input-delist-source-url").value = "";
          loadDelistItemsAndSettings();
        }
      } catch (e) {
        showToast("追加エラー", "error");
      }
    });
  }

  const runCheckNowBtn = document.getElementById("btn-run-delist-check-now");
  if (runCheckNowBtn) {
    runCheckNowBtn.addEventListener("click", async () => {
      runCheckNowBtn.textContent = "⌛ チェック中...";
      runCheckNowBtn.disabled = true;
      try {
        const res = await fetch("/api/ebay/delist-check-now", { method: "POST" });
        const data = await res.json();
        showToast(data.message || "チェック完了！", "success");
        loadDelistItemsAndSettings();
      } catch (e) {
        showToast("チェック実行エラー", "error");
      } finally {
        runCheckNowBtn.textContent = "⚡ 在庫チェック＆取り下げ実行";
        runCheckNowBtn.disabled = false;
      }
    });
  }

  // --- SaaS 顧客アカウント管理ハンドラー ---
  const addSaasBtn = document.getElementById("btn-add-saas-user");
  if (addSaasBtn) {
    addSaasBtn.addEventListener("click", () => {
      const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      currentArbitrageSaasUsers.push({
        id: 'user_' + Date.now(),
        name: `新規顧客 ${currentArbitrageSaasUsers.length + 1}`,
        spreadsheetId: '',
        lineChannelAccessToken: '',
        lineUserId: '',
        mode: 'line_transfer',
        enabled: true,
        createdAt: today,
        lastSyncTime: '未実行',
        lastStatus: '待機中'
      });
      renderSaasUsersArbitrage();
    });
  }

  const saveSaasBtn = document.getElementById("btn-save-saas-users");
  if (saveSaasBtn) {
    saveSaasBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/saas/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ users: currentArbitrageSaasUsers })
        });
        if (res.ok) {
          showToast("顧客設定を保存しました！", "success");
        }
      } catch (e) {
        showToast("保存エラー", "error");
      }
    });
  }
}

const DEFAULT_ARBITRAGE_SAAS_USER = {
  id: "user_default",
  name: "メインアカウント（ユーザー1）",
  spreadsheetId: "15skxiK9eL6JDzq76JX3_3uS5-puJIqGGZngv3bJ4iv4",
  lineChannelAccessToken: "B2HWvVXYh0ryq+ok/xCrmHzlvbuHPONV5nASZu8NX2yby3UPeZF1YWtE14k4xk3VX5cRh7Kqeix7AwKuBP03EzKiOi6xt0mOqTx4hXvMJ/ge1LClYlrmYyTiVNJMh8t6x/yFa6HVoQAimZh66BrldwdB04t89/1O/w1cDnyilFU=",
  lineUserId: "U25f6fe2beb5ac799dfcd3014e17a578c",
  mode: "line_transfer",
  enabled: true,
  createdAt: "2026/08/08",
  lastSyncTime: "2026/8/20 15:00:00",
  lastStatus: "正常完了"
};

let currentArbitrageSaasUsers = [DEFAULT_ARBITRAGE_SAAS_USER];

async function loadSaasUsersArbitrage() {
  const container = document.getElementById("saas-users-container");
  if (!container) return;
  try {
    const res = await fetch("/api/saas/users");
    const data = await res.json();
    if (data.success && Array.isArray(data.users) && data.users.length > 0) {
      currentArbitrageSaasUsers = data.users;
    } else {
      currentArbitrageSaasUsers = [DEFAULT_ARBITRAGE_SAAS_USER];
    }
    renderSaasUsersArbitrage();
  } catch (e) {
    if (currentArbitrageSaasUsers.length === 0) currentArbitrageSaasUsers = [DEFAULT_ARBITRAGE_SAAS_USER];
    renderSaasUsersArbitrage();
  }
}

function renderSaasUsersArbitrage() {
  const container = document.getElementById("saas-users-container");
  if (!container) return;
  container.innerHTML = "";

  if (currentArbitrageSaasUsers.length === 0) {
    container.innerHTML = '<div style="font-size: 12px; color: #64748b;">登録された顧客アカウントはありません。</div>';
    return;
  }

  currentArbitrageSaasUsers.forEach((user, index) => {
    const card = document.createElement("div");
    card.style.cssText = "background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
        <span style="font-weight: 700; color: #38bdf8; font-size: 14px;">👤 顧客アカウント #${index + 1}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: #a7f3d0; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 4px;">📅 登録日: ${user.createdAt || '2026/08/08'}</span>
          <button type="button" class="btn-delete-saas-user" data-index="${index}" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer;">削除</button>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">顧客名 / アカウント名</label>
          <input type="text" class="saas-user-name" data-index="${index}" value="${user.name || ''}" placeholder="例: A社 様 / ユーザー1" style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 6px 10px; font-size: 12px;">
        </div>
        <div>
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">スプレッドシートID</label>
          <input type="text" class="saas-user-sheet" data-index="${index}" value="${user.spreadsheetId || ''}" placeholder="15skxiK9eL6JDzq..." style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 6px 10px; font-size: 12px;">
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">LINE Access Token</label>
          <input type="password" class="saas-user-token" data-index="${index}" value="${user.lineChannelAccessToken || ''}" placeholder="B2HWvVXYh0ry..." style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 6px 10px; font-size: 12px;">
        </div>
        <div>
          <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">LINE User ID</label>
          <input type="text" class="saas-user-userid" data-index="${index}" value="${user.lineUserId || ''}" placeholder="U25f6fe2beb5..." style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 6px 10px; font-size: 12px;">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; margin-top: 4px;">
        <span>最終同期: ${user.lastSyncTime || '未実行'}</span>
        <span>状態: ${user.lastStatus || '正常'}</span>
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll(".btn-delete-saas-user").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentArbitrageSaasUsers.splice(idx, 1);
      renderSaasUsersArbitrage();
    });
  });

  document.querySelectorAll(".saas-user-name").forEach(i => {
    i.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentArbitrageSaasUsers[idx].name = e.target.value;
    });
  });
  document.querySelectorAll(".saas-user-sheet").forEach(i => {
    i.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.index, 10);
      let val = e.target.value.trim();
      const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) val = match[1];
      currentArbitrageSaasUsers[idx].spreadsheetId = val;
    });
  });
  document.querySelectorAll(".saas-user-token").forEach(i => {
    i.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentArbitrageSaasUsers[idx].lineChannelAccessToken = e.target.value.trim();
    });
  });
  document.querySelectorAll(".saas-user-userid").forEach(i => {
    i.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentArbitrageSaasUsers[idx].lineUserId = e.target.value.trim();
    });
  });
}

// 起動初期化
window.addEventListener("DOMContentLoaded", () => {
  setupModalCalculations();
  setupDetailMasterHandlers();
  setupDelistHandlers();
  initEvents();
  loadStatusAndRate();
  loadTargets();
  loadDetections();
  loadSaasUsersArbitrage();

  // 10秒ごとにイベントポーリング
  setInterval(pollEvents, 10000);
});

