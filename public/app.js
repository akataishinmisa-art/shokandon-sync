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
    saveConfigBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        const userId = userIdInput.value.trim();

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

    // Test LINE Notification
    testLineBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        const userId = userIdInput.value.trim();

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

    let currentSaasUsers = [];

    function loadSaasUsers() {
        if (!saasUsersList) return;
        fetch('/api/saas/users')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.users)) {
                    currentSaasUsers = data.users;
                    renderSaasUsers();
                }
            })
            .catch(() => {});
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

    loadSaasUsers();
});
