document.addEventListener('DOMContentLoaded', () => {
    const CLOUD_BASE_URL = 'https://shokandon-sync.onrender.com';

    function apiFetch(url, options = {}) {
        const hostname = window.location.hostname;
        const isRender = hostname.includes('onrender.com');
        const requestUrl = (!isRender && !url.startsWith('http')) ? `${CLOUD_BASE_URL}${url}` : url;

        return fetch(requestUrl, options).catch(err => {
            console.error('Fetch failed:', err);
            throw err;
        });
    }

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
    apiFetch('/api/config')
        .then(res => res.json())
        .then(cfg => {
            if (cfg.lineChannelAccessToken) tokenInput.value = cfg.lineChannelAccessToken;
            if (cfg.lineUserId) userIdInput.value = cfg.lineUserId;
        })
        .catch(err => console.error('Failed to load config:', err));

    const scheduleBadge = document.getElementById('scheduleBadge');
    const scheduleText = document.getElementById('scheduleText');

    function updateScheduleUI() {
        apiFetch('/api/schedule-status')
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
            apiFetch('/api/schedule-toggle', { method: 'POST' })
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
    saveConfigBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        const userId = userIdInput.value.trim();

        apiFetch('/api/config', {
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

    // Test LINE Notification
    testLineBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        const userId = userIdInput.value.trim();

        showAlert('⏳ LINE送信テスト中...', 'success');

        apiFetch('/api/test-line', {
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

    function showAlert(msg, type) {
        settingsAlert.textContent = msg;
        settingsAlert.className = `alert-msg ${type}`;
    }

    // Run Sync Action
    runSyncBtn.addEventListener('click', () => {
        const selectedMode = document.querySelector('input[name="syncMode"]:checked').value;

        runSyncBtn.disabled = true;
        btnLabelText.textContent = '同期処理＆画像保存を実行中...';
        serverStatusPill.classList.add('running');
        statusText.textContent = '同期処理＆全画像ダウンロード中...';

        apiFetch('/api/run-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: selectedMode })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                startPollingStatus();
            } else {
                alert(data.message);
                resetButtonState();
            }
        })
        .catch(err => {
            alert('通信エラーが発生しました。');
            resetButtonState();
        });
    });

    function startPollingStatus() {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(() => {
            apiFetch('/api/status')
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
    apiFetch('/api/status')
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
});
