document.addEventListener('DOMContentLoaded', () => {
    const runSyncBtn = document.getElementById('runSyncBtn');
    const btnLabelText = document.getElementById('btnLabelText');
    const terminalLog = document.getElementById('terminalLog');
    const statusText = document.getElementById('statusText');
    const serverStatusPill = document.getElementById('serverStatusPill');

    const tokenInput = document.getElementById('tokenInput');
    const userIdInput = document.getElementById('userIdInput');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const testLineBtn = document.getElementById('testLineBtn');
    const settingsAlert = document.getElementById('settingsAlert');
    const openImagesFolderBtn = document.getElementById('openImagesFolderBtn');

    const radioCards = document.querySelectorAll('.radio-card');
    let pollInterval = null;

    // Load saved LINE config from server
    fetch('/api/config')
        .then(res => res.json())
        .then(cfg => {
            if (cfg.lineChannelAccessToken) tokenInput.value = cfg.lineChannelAccessToken;
            if (cfg.lineUserId) userIdInput.value = cfg.lineUserId;
        })
        .catch(err => console.error('Failed to load config:', err));

    const scheduleBadge = document.getElementById('scheduleBadge');
    const scheduleText = document.getElementById('scheduleText');

    function updateScheduleUI() {
        fetch('/api/schedule-status')
            .then(res => res.json())
            .then(data => {
                if (scheduleText && scheduleBadge) {
                    if (data.enabled) {
                        scheduleText.textContent = `⏰ 自動スケジュール: ${data.scheduleRange} ${data.mode} (稼働中)`;
                        scheduleBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                        scheduleBadge.style.borderColor = '#10b981';
                        scheduleBadge.style.color = '#34d399';
                    } else {
                        scheduleText.textContent = `⏰ 自動スケジュール: 一時停止中 (クリックで有効化)`;
                        scheduleBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                        scheduleBadge.style.borderColor = '#ef4444';
                        scheduleBadge.style.color = '#f87171';
                    }
                }
            })
            .catch(() => {});
    }

    if (scheduleBadge) {
        scheduleBadge.addEventListener('click', () => {
            fetch('/api/schedule-toggle', { method: 'POST' })
                .then(res => res.json())
                .then(() => updateScheduleUI());
        });
    }

    updateScheduleUI();

    // Token Usage Modal Handlers
    const openTokenUsageBtn = document.getElementById('openTokenUsageBtn');
    const tokenUsageModal = document.getElementById('tokenUsageModal');
    const closeTokenModalBtn = document.getElementById('closeTokenModalBtn');
    const closeTokenModalFooterBtn = document.getElementById('closeTokenModalFooterBtn');

    function openModal() {
        if (tokenUsageModal) tokenUsageModal.classList.add('active');
    }

    function closeModal() {
        if (tokenUsageModal) tokenUsageModal.classList.remove('active');
    }

    if (openTokenUsageBtn) openTokenUsageBtn.addEventListener('click', openModal);
    if (closeTokenModalBtn) closeTokenModalBtn.addEventListener('click', closeModal);
    if (closeTokenModalFooterBtn) closeTokenModalFooterBtn.addEventListener('click', closeModal);
    if (tokenUsageModal) {
        tokenUsageModal.addEventListener('click', (e) => {
            if (e.target === tokenUsageModal) closeModal();
        });
    }

    // Radio button UI toggle
    radioCards.forEach(card => {
        card.addEventListener('click', () => {
            radioCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Save LINE Config
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            const token = tokenInput ? tokenInput.value.trim() : '';
            const userId = userIdInput ? userIdInput.value.trim() : '';

            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineChannelAccessToken: token, lineUserId: userId })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showAlert('✅ LINE設定を正常に保存しました！', 'success');
                } else {
                    showAlert('❌ 設定の保存に失敗しました。', 'error');
                }
            })
            .catch(() => showAlert('❌ サーバー通信エラーが発生しました。', 'error'));
        });
    }

    // Test LINE Notification
    if (testLineBtn) {
        testLineBtn.addEventListener('click', () => {
            const token = tokenInput ? tokenInput.value.trim() : '';
            const userId = userIdInput ? userIdInput.value.trim() : '';

            showAlert('⏳ LINE送信テスト中...', 'success');

            fetch('/api/test-line', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, userId })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showAlert('🎉 テストメッセージをLINEへ正常送信しました！スマホをご確認ください。', 'success');
                } else {
                    showAlert(`❌ 送信失敗: ${data.error || 'レスポンスコード ' + data.statusCode + ' ' + (data.body || '')}`, 'error');
                }
            })
            .catch(() => showAlert('❌ サーバー通信エラーが発生しました。', 'error'));
        });
    }

    function showAlert(msg, type) {
        if (settingsAlert) {
            settingsAlert.textContent = msg;
            settingsAlert.className = `alert-msg ${type}`;
        }
    }

    // Run Sync Action
    if (runSyncBtn) {
        runSyncBtn.addEventListener('click', () => {
            const selectedMode = document.querySelector('input[name="syncMode"]:checked').value;

            runSyncBtn.disabled = true;
            btnLabelText.textContent = '同期処理＆画像保存を実行中...';
            serverStatusPill.classList.add('running');
            statusText.textContent = '同期処理＆全画像ダウンロード中...';

            fetch('/api/run-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: selectedMode })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    startPollingStatus();
                } else {
                    alert(data.message || '同期の起動に失敗しました');
                    resetButtonState();
                }
            })
            .catch(() => {
                alert('サーバーとの通信エラーが発生しました');
                resetButtonState();
            });
        });
    }

    function startPollingStatus() {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(() => {
            fetch('/api/status')
                .then(res => res.json())
                .then(data => {
                    if (data.logs) {
                        terminalLog.textContent = data.logs;
                        terminalLog.scrollTop = terminalLog.scrollHeight;
                    }

                    const isFinishedLog = data.logs && (
                        data.logs.includes('completed successfully!') ||
                        data.logs.includes('処理完了')
                    );

                    if (!data.isRunning || isFinishedLog) {
                        clearInterval(pollInterval);
                        resetButtonState();
                        statusText.textContent = '🎉 全処理完了（画像保存完了）';
                    }
                })
                .catch(() => clearInterval(pollInterval));
        }, 1200);
    }

    function resetButtonState() {
        runSyncBtn.disabled = false;
        btnLabelText.textContent = 'スプレッドシート自動同期 ＆ 全画像保存を実行する';
        serverStatusPill.classList.remove('running');
    }

    // Initial status check
    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            if (data.isRunning) {
                runSyncBtn.disabled = true;
                btnLabelText.textContent = '同期処理＆画像保存を実行中...';
                serverStatusPill.classList.add('running');
                statusText.textContent = '同期処理＆全画像ダウンロード中...';
                startPollingStatus();
            } else {
                if (data.logs && data.logs.length > 0) {
                    terminalLog.textContent = data.logs;
                    terminalLog.scrollTop = terminalLog.scrollHeight;
                }
            }
        });

    // --- SaaS Multi-Tenant Users Management Logic ---
    const saasUsersList = document.getElementById('saasUsersList');
    const addSaasUserBtn = document.getElementById('addSaasUserBtn');
    const saveSaasUsersBtn = document.getElementById('saveSaasUsersBtn');
    const saasUsersAlert = document.getElementById('saasUsersAlert');

    const DEFAULT_SAAS_USER = {
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

    let currentSaasUsers = [DEFAULT_SAAS_USER];

    function loadSaasUsers() {
        if (!saasUsersList) return;
        fetch('/api/saas/users')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.users) && data.users.length > 0) {
                    currentSaasUsers = data.users;
                } else {
                    currentSaasUsers = [DEFAULT_SAAS_USER];
                }
                renderSaasUsers();
            })
            .catch(() => {
                if (currentSaasUsers.length === 0) currentSaasUsers = [DEFAULT_SAAS_USER];
                renderSaasUsers();
            });
    }

    function renderSaasUsers() {
        if (!saasUsersList) return;
        saasUsersList.innerHTML = '';

        if (currentSaasUsers.length === 0) {
            saasUsersList.innerHTML = '<div style="font-size: 0.8rem; color: #64748b;">登録された顧客アカウントはありません。</div>';
            return;
        }

        currentSaasUsers.forEach((user, index) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 0.8rem; display: flex; flex-direction: column; gap: 0.5rem;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem;">
                    <span style="font-weight: 700; color: #38bdf8; font-size: 0.9rem;">👤 顧客アカウント #${index + 1}</span>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.72rem; color: #a7f3d0; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.1rem 0.4rem; border-radius: 4px;">📅 登録日: ${user.createdAt || '2026/08/08'}</span>
                        <button type="button" class="btn-delete-user" data-index="${index}" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; border-radius: 4px; padding: 0.15rem 0.5rem; font-size: 0.75rem; cursor: pointer;">削除</button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div>
                        <label style="font-size: 0.75rem; color: #94a3b8;">顧客名 / アカウント名</label>
                        <input type="text" class="user-name-input" data-index="${index}" value="${user.name || ''}" placeholder="例: A社 様 / ユーザー1" style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 0.3rem 0.5rem; font-size: 0.8rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #94a3b8;">スプレッドシートID</label>
                        <input type="text" class="user-sheet-input" data-index="${index}" value="${user.spreadsheetId || ''}" placeholder="15skxiK9eL6JDzq..." style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 0.3rem 0.5rem; font-size: 0.8rem;">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div>
                        <label style="font-size: 0.75rem; color: #94a3b8;">LINE Access Token</label>
                        <input type="password" class="user-token-input" data-index="${index}" value="${user.lineChannelAccessToken || ''}" placeholder="B2HWvVXYh0ry..." style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 0.3rem 0.5rem; font-size: 0.8rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #94a3b8;">LINE User ID</label>
                        <input type="text" class="user-userid-input" data-index="${index}" value="${user.lineUserId || ''}" placeholder="U25f6fe2beb5..." style="width: 100%; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; padding: 0.3rem 0.5rem; font-size: 0.8rem;">
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
                    <span>最終同期: ${user.lastSyncTime || '未実行'}</span>
                    <span>状態: ${user.lastStatus || '正常'}</span>
                </div>
            `;
            saasUsersList.appendChild(card);
        });

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                currentSaasUsers.splice(idx, 1);
                renderSaasUsers();
            });
        });

        document.querySelectorAll('.user-name-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                currentSaasUsers[idx].name = e.target.value;
            });
        });
        document.querySelectorAll('.user-sheet-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                let val = e.target.value.trim();
                const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
                if (match) val = match[1];
                currentSaasUsers[idx].spreadsheetId = val;
            });
        });
        document.querySelectorAll('.user-token-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                currentSaasUsers[idx].lineChannelAccessToken = e.target.value.trim();
            });
        });
        document.querySelectorAll('.user-userid-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                currentSaasUsers[idx].lineUserId = e.target.value.trim();
            });
        });
    }

    if (addSaasUserBtn) {
        addSaasUserBtn.addEventListener('click', () => {
            const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
            currentSaasUsers.push({
                id: 'user_' + Date.now(),
                name: `新規顧客 ${currentSaasUsers.length + 1}`,
                spreadsheetId: '',
                lineChannelAccessToken: '',
                lineUserId: '',
                mode: 'line_transfer',
                enabled: true,
                createdAt: today,
                lastSyncTime: '未実行',
                lastStatus: '待機中'
            });
            renderSaasUsers();
        });
    }

    if (saveSaasUsersBtn) {
        saveSaasUsersBtn.addEventListener('click', () => {
            saasUsersAlert.style.color = '#38bdf8';
            saasUsersAlert.textContent = '保存中...';
            fetch('/api/saas/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: currentSaasUsers })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    saasUsersAlert.style.color = '#34d399';
                    saasUsersAlert.textContent = '✅ SaaS顧客アカウント設定を更新・保存しました！';
                } else {
                    saasUsersAlert.style.color = '#f87171';
                    saasUsersAlert.textContent = '保存エラー: ' + data.message;
                }
            })
            .catch(() => {
                saasUsersAlert.style.color = '#f87171';
                saasUsersAlert.textContent = '通信エラーが発生しました。';
            });
        });
    }

    // --- eBay Developer API & Auto-Delist Handlers ---
    const ebayAppIdInput = document.getElementById('ebayAppIdInput');
    const ebayDevIdInput = document.getElementById('ebayDevIdInput');
    const ebayCertIdInput = document.getElementById('ebayCertIdInput');
    const ebayUserTokenInput = document.getElementById('ebayUserTokenInput');
    const ebayDelistModeSelect = document.getElementById('ebayDelistModeSelect');
    const saveEbayMainKeysBtn = document.getElementById('saveEbayMainKeysBtn');
    const runEbayDelistCheckMainBtn = document.getElementById('runEbayDelistCheckMainBtn');
    const ebayMainAlert = document.getElementById('ebayMainAlert');
    const btnToggleCertIdMain = document.getElementById('btnToggleCertIdMain');

    if (btnToggleCertIdMain && ebayCertIdInput) {
        btnToggleCertIdMain.addEventListener('click', () => {
            if (ebayCertIdInput.type === 'password') {
                ebayCertIdInput.type = 'text';
                btnToggleCertIdMain.textContent = '🔒';
            } else {
                ebayCertIdInput.type = 'password';
                btnToggleCertIdMain.textContent = '👁️';
            }
        });
    }

    // フォーカス時に全選択して簡単に書き換え・貼り付けできるようにする
    if (ebayCertIdInput) {
        ebayCertIdInput.addEventListener('focus', () => {
            ebayCertIdInput.select();
        });
    }
    if (ebayAppIdInput) {
        ebayAppIdInput.addEventListener('focus', () => {
            ebayAppIdInput.select();
        });
    }

    function loadEbayMainSettings() {
        fetch('/api/user-settings')
            .then(res => res.json())
            .then(cfg => {
                if (ebayAppIdInput && cfg.ebayAppId) ebayAppIdInput.value = cfg.ebayAppId;
                if (ebayDevIdInput && cfg.ebayDevId) ebayDevIdInput.value = cfg.ebayDevId;
                if (ebayCertIdInput && cfg.ebayCertId) ebayCertIdInput.value = cfg.ebayCertId;
                if (ebayUserTokenInput && cfg.ebayUserToken) ebayUserTokenInput.value = cfg.ebayUserToken;
                if (ebayDelistModeSelect && cfg.ebayDelistMode) ebayDelistModeSelect.value = cfg.ebayDelistMode;
            })
            .catch(() => {});
    }

    if (saveEbayMainKeysBtn) {
        saveEbayMainKeysBtn.addEventListener('click', () => {
            const payload = {
                ebayAppId: ebayAppIdInput ? ebayAppIdInput.value.trim() : '',
                ebayDevId: ebayDevIdInput ? ebayDevIdInput.value.trim() : '',
                ebayCertId: ebayCertIdInput ? ebayCertIdInput.value.trim() : '',
                ebayUserToken: ebayUserTokenInput ? ebayUserTokenInput.value.trim() : '',
                ebayDelistMode: ebayDelistModeSelect ? ebayDelistModeSelect.value : 'end_item'
            };

            if (ebayMainAlert) {
                ebayMainAlert.style.color = '#38bdf8';
                ebayMainAlert.textContent = '保存中...';
            }

            fetch('/api/user-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (ebayMainAlert) {
                        ebayMainAlert.style.color = '#34d399';
                        ebayMainAlert.textContent = '✅ eBay Developer API設定を正常に保存しました！';
                    }
                } else {
                    if (ebayMainAlert) {
                        ebayMainAlert.style.color = '#f87171';
                        ebayMainAlert.textContent = '保存に失敗しました。';
                    }
                }
            })
            .catch(() => {
                if (ebayMainAlert) {
                    ebayMainAlert.style.color = '#f87171';
                    ebayMainAlert.textContent = '通信エラーが発生しました。';
                }
            });
        });
    }

    if (runEbayDelistCheckMainBtn) {
        runEbayDelistCheckMainBtn.addEventListener('click', async () => {
            runEbayDelistCheckMainBtn.disabled = true;
            const origTxt = runEbayDelistCheckMainBtn.textContent;
            runEbayDelistCheckMainBtn.textContent = '⌛ チェック中...';
            if (ebayMainAlert) {
                ebayMainAlert.style.color = '#38bdf8';
                ebayMainAlert.textContent = '全仕入れ元チェック ＆ eBay自動取り下げ処理を実行中...';
            }

            try {
                const res = await fetch('http://127.0.0.1:8000/api/ebay/delist-check-now', { method: 'POST' });
                const data = await res.json();
                if (ebayMainAlert) {
                    ebayMainAlert.style.color = '#34d399';
                    ebayMainAlert.textContent = data.message || '✅ 在庫チェック ＆ 自動取り下げを実行しました！';
                }
            } catch (e) {
                if (ebayMainAlert) {
                    ebayMainAlert.style.color = '#f87171';
                    ebayMainAlert.textContent = '取り下げ実行通信エラー (ポート8000の起動を確認してください)';
                }
            } finally {
                runEbayDelistCheckMainBtn.disabled = false;
                runEbayDelistCheckMainBtn.textContent = origTxt;
            }
        });
    }

    loadEbayMainSettings();
    loadSaasUsers();

    // 🎯 仕入れ監視システム: ボタンを押すだけで自動起動＆安全オープン（多重起動なし）
    const btnOpenMonitor = document.getElementById('btnOpenStockMonitor');
    if (btnOpenMonitor) {
        btnOpenMonitor.addEventListener('click', async (e) => {
            e.preventDefault();
            const originalHtml = btnOpenMonitor.innerHTML;
            btnOpenMonitor.innerHTML = '⌛ サーバー起動中...';
            btnOpenMonitor.style.pointerEvents = 'none';

            try {
                const res = await fetch('/api/stock-monitor/launch');
                const data = await res.json();
                window.open(data.url || 'http://127.0.0.1:8000', '_blank');
            } catch (err) {
                console.error('Launch error:', err);
                window.open('http://127.0.0.1:8000', '_blank');
            } finally {
                btnOpenMonitor.innerHTML = originalHtml;
                btnOpenMonitor.style.pointerEvents = 'auto';
            }
        });
    }

    const btnSyncFromSheetTab = document.getElementById('btnSyncFromSheetTab');
    if (btnSyncFromSheetTab) {
        btnSyncFromSheetTab.addEventListener('click', () => {
            if (runSyncBtn) runSyncBtn.click();
        });
    }

    // --- 🌸 SAKURA Sync 親サイドバーのナビゲーション ＆ アコーディオン完全連動ハンドラー ---
    const navBtnMonitor = document.getElementById('nav-btn-monitor');
    const monitorSubmenu = document.getElementById('monitorSubmenu');
    const accordionArrow = document.getElementById('accordionArrow');
    const monitorIframe = document.getElementById('monitorIframe');
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const subNavItems = document.querySelectorAll('.sub-nav-item');

    let isAccordionOpen = true;

    function switchTab(targetTabId) {
        navItems.forEach(b => {
            const t = b.getAttribute('data-tab');
            if (t === targetTabId) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        const tabPanes = document.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
            if (pane.id === targetTabId) {
                pane.classList.add('active');
                pane.style.display = 'block';
            } else {
                pane.classList.remove('active');
                pane.style.display = 'none';
            }
        });
    }

    // 1. 「仕入れ監視・リサーチ」アコーディオン展開・折りたたみボタン
    if (navBtnMonitor && monitorSubmenu) {
        navBtnMonitor.addEventListener('click', (e) => {
            monitorSubmenu.style.display = 'flex';
            if (accordionArrow) accordionArrow.style.transform = 'rotate(0deg)';
            switchTab('tab-monitor');
        });
    }

    // --- 🌸 SAKURA Sync 親サイドバーの動的カテゴリ＆商品アコーディオンツリー連動 ---
    function sendIframeCategoryMessage(category) {
        if (monitorIframe && monitorIframe.contentWindow) {
            monitorIframe.contentWindow.postMessage({
                type: 'FILTER_CATEGORY',
                category: category
            }, '*');
        }
    }

    // 🌸 子iframeからの商品選択（ドロップダウン等）連動 ➔ 左サイドバーアイテムのアクティブハイライト
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TARGET_ITEM_SELECTED') {
            const targetId = String(event.data.targetId);
            const itemBtn = document.querySelector(`.parent-item-btn[data-target-id="${targetId}"]`);
            if (itemBtn) {
                highlightSubNavItem(itemBtn);
                const catGroup = itemBtn.closest('.parent-cat-group');
                if (catGroup) {
                    catGroup.classList.add('open');
                    const container = catGroup.querySelector('.parent-cat-subitems');
                    if (container) container.style.display = 'flex';
                    const arrow = catGroup.querySelector('.cat-arrow');
                    if (arrow) arrow.style.transform = 'rotate(90deg)';
                }
            } else if (targetId === 'all') {
                const allBtn = document.querySelector('.sub-nav-item[data-cat="all"]');
                if (allBtn) highlightSubNavItem(allBtn);
            }
        }
    });

    function highlightSubNavItem(activeEl) {
        document.querySelectorAll('.sub-nav-item, .parent-cat-header').forEach(i => {
            i.classList.remove('active');
            i.style.background = 'transparent';
            i.style.borderColor = 'transparent';
            i.style.color = '#94a3b8';
        });
        if (activeEl) {
            activeEl.classList.add('active');
            activeEl.style.background = 'rgba(56, 189, 248, 0.15)';
            activeEl.style.borderColor = 'rgba(56, 189, 248, 0.3)';
            activeEl.style.color = '#f8fafc';
        }
    }

    async function loadParentSidebarTargets() {
        const monitorSubmenu = document.getElementById('monitorSubmenu');
        if (!monitorSubmenu) return;

        try {
            const res = await fetch('/api/targets');
            if (!res.ok) return;
            const targetItems = await res.json();

            // カテゴリ別グループ化
            const catMap = {
                '📷 デジタルカメラ': [],
                '🎮 ゲーム機本体': [],
                '⌚ 時計・ブランド': [],
                '📁 その他・未分類': []
            };

            targetItems.forEach(item => {
                let cat = item.category || '';
                if (!cat || !catMap[cat]) {
                    const n = (item.name || '').toLowerCase();
                    if (n.includes('dmc') || n.includes('s110') || n.includes('ixy') || n.includes('exilim') || n.includes('camera') || n.includes('powershot') || n.includes('lumix') || n.includes('olympus') || n.includes('canon') || n.includes('nikon') || n.includes('casio')) {
                        cat = '📷 デジタルカメラ';
                    } else if (n.includes('3ds') || n.includes('vita') || n.includes('pch') || n.includes('ps') || n.includes('switch') || n.includes('nintendo') || n.includes('sony playstation')) {
                        cat = '🎮 ゲーム機本体';
                    } else {
                        cat = '📁 その他・未分類';
                    }
                }
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(item);
            });

            monitorSubmenu.innerHTML = '';

            // 1. ALL （全商品リスト）ボタン
            const allBtn = document.createElement('button');
            allBtn.className = 'sub-nav-item active';
            allBtn.setAttribute('data-cat', 'all');
            allBtn.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#f8fafc; padding:6px 12px; border-radius:6px; font-size:0.82rem; cursor:pointer; text-align:left; width:100%; margin-bottom:6px;';
            allBtn.innerHTML = `<span>🎯 登録商品リスト (全件一覧)</span><span class="badge" style="background:#1e293b; color:#38bdf8; padding:2px 6px; border-radius:10px; font-size:0.7rem;">${targetItems.length}</span>`;
            
            allBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                highlightSubNavItem(allBtn);
                switchTab('tab-monitor');
                sendIframeCategoryMessage('all');
            });
            monitorSubmenu.appendChild(allBtn);

            // 2. 各カテゴリー ＆ 配下商品ツリーのレンダリング
            Object.entries(catMap).forEach(([catName, items]) => {
                if (items.length === 0) return;

                const catGroup = document.createElement('div');
                catGroup.className = 'parent-cat-group open';
                catGroup.style.cssText = 'display:flex; flex-direction:column; gap:2px; margin-bottom:6px;';

                // カテゴリーヘッダー（クリックで展開・折りたたみ）
                const catHeader = document.createElement('button');
                catHeader.className = 'parent-cat-header';
                catHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(30, 41, 59, 0.6); border:1px solid rgba(255,255,255,0.08); color:#cbd5e1; padding:6px 10px; border-radius:6px; font-size:0.8rem; font-weight:700; cursor:pointer; text-align:left; width:100%; transition:all 0.15s ease;';
                catHeader.innerHTML = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="cat-arrow" style="font-size:0.65rem; transition:transform 0.2s ease; display:inline-block; transform:rotate(90deg);">▶</span>
                        <span>${catName}</span>
                    </div>
                    <span style="background:rgba(255,255,255,0.1); color:#94a3b8; padding:1px 6px; border-radius:8px; font-size:0.7rem;">${items.length}</span>
                `;

                // 個別商品リンクの格納コンテナ
                const itemContainer = document.createElement('div');
                itemContainer.className = 'parent-cat-subitems';
                itemContainer.style.cssText = 'display:flex; flex-direction:column; gap:2px; padding-left:12px; margin-top:2px;';

                items.forEach(item => {
                    const itemBtn = document.createElement('button');
                    itemBtn.className = 'sub-nav-item parent-item-btn';
                    itemBtn.setAttribute('data-target-id', item.id);
                    itemBtn.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(15, 23, 42, 0.4); border:1px solid rgba(255,255,255,0.05); color:#94a3b8; padding:5px 8px; border-radius:4px; font-size:0.76rem; cursor:pointer; text-align:left; width:100%; transition:all 0.15s ease;';
                    
                    const priceText = item.max_buy_price_jpy > 0 ? `¥${Math.round(item.max_buy_price_jpy).toLocaleString()}` : '';
                    itemBtn.innerHTML = `
                        <span style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.name}">• ${item.name}</span>
                        <span style="font-size:0.7rem; color:#38bdf8; font-family:monospace;">${priceText}</span>
                    `;

                    // 個別商品クリック処理
                    itemBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        highlightSubNavItem(itemBtn);
                        switchTab('tab-monitor');
                        
                        if (monitorIframe && monitorIframe.contentWindow) {
                            monitorIframe.contentWindow.postMessage({
                                type: 'SELECT_TARGET_ITEM',
                                targetId: String(item.id)
                            }, '*');
                        }
                    });

                    itemContainer.appendChild(itemBtn);
                });

                // ★初期状態：アコーディオンを全開（OPEN）にして商品をズラリ表示！
                catGroup.classList.add('open');
                itemContainer.style.display = 'flex';
                const arrow = catHeader.querySelector('.cat-arrow');
                if (arrow) arrow.style.transform = 'rotate(90deg)';

                // カテゴリーヘッダークリック処理（開閉トグル ＆ カテゴリ全件表示）
                catHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = catGroup.classList.contains('open');
                    const currentArrow = catHeader.querySelector('.cat-arrow');
                    
                    if (isOpen) {
                        catGroup.classList.remove('open');
                        itemContainer.style.display = 'none';
                        if (currentArrow) currentArrow.style.transform = 'rotate(0deg)';
                    } else {
                        catGroup.classList.add('open');
                        itemContainer.style.display = 'flex';
                        if (currentArrow) currentArrow.style.transform = 'rotate(90deg)';
                    }

                    highlightSubNavItem(catHeader);
                    switchTab('tab-monitor');
                    sendIframeCategoryMessage(catName);
                });

                catGroup.appendChild(catHeader);
                catGroup.appendChild(itemContainer);
                monitorSubmenu.appendChild(catGroup);
            });

        } catch (err) {
            console.error('Failed to load parent sidebar targets:', err);
        }
    }

    loadParentSidebarTargets();

    // 3. 他のメインメニュー（⚡ 出品＆タイトル作成, 🔄 自動同期＆実行ログ, ⚙️ 設定＆連携アカウント）クリック
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) {
                switchTab(tabId);
            }
        });
    });

    // 初期起動時: 「自動同期＆実行ログ」を一番上のアクティブタブとしてセット
    switchTab('tab-sync');
});
