
// renderer.js — Compact & Productive layout

// ── WINDOW CONTROLS ─────────────────────────────────────────
document.getElementById('min-btn').onclick   = () => window.launcher.window.minimize();
document.getElementById('close-btn').onclick = () => window.launcher.window.close();

// ── SIDEBAR NAV (tab switching) ──────────────────────────────
const navBtns   = document.querySelectorAll('.nav-btn[data-tab]');
const tabPanels = document.querySelectorAll('.tab-panel');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        navBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById(`${tab}-tab`);
        if (panel) panel.classList.add('active');

        if (tab === 'users')       loadAccounts();
        if (tab === 'screenshots') loadScreenshots();
    });
});

// ── SEARCH FILTER ────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        const select = document.getElementById('version-select');
        if (!select) return;
        Array.from(select.options).forEach(opt => {
            const show = !q || opt.text.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
            opt.hidden = !show;
        });
        // select first visible option
        const first = Array.from(select.options).find(o => !o.hidden && o.value);
        if (first) select.value = first.value;
    });
}

// ── UTILS ────────────────────────────────────────────────────
function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024)            return bytes + ' B';
    if (bytes < 1048576)         return (bytes / 1024).toFixed(0) + ' KB';
    if (bytes < 1073741824)      return (bytes / 1048576).toFixed(0) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ── JAVA BADGE ───────────────────────────────────────────────
async function loadJavaBadge() {
    const badge = document.getElementById('java-badge');
    const text  = document.getElementById('java-version-text');
    if (!badge || !text) return;
    try {
        const res = await window.launcher.java.getVersion();
        if (res && res.version) {
            text.textContent = res.version;
            badge.classList.remove('error');
        } else {
            text.textContent = 'Java não encontrado';
            badge.classList.add('error');
        }
    } catch (e) {
        text.textContent = 'Java ?';
        badge.classList.add('error');
    }
}

// ── PROFILE ──────────────────────────────────────────────────
function updateProfileCard(account) {
    const nameEl      = document.getElementById('profile-name');
    const avatarEl    = document.getElementById('profile-avatar');
    const sideAvatar  = document.getElementById('sidebar-avatar');
    if (!nameEl || !avatarEl) return;
    if (account && account.username) {
        const url = `https://minotar.net/helm/${encodeURIComponent(account.username)}/64`;
        nameEl.textContent = account.username;
        avatarEl.src       = url;
        avatarEl.alt       = account.username;
        if (sideAvatar) { sideAvatar.src = url; sideAvatar.title = account.username; }
    } else {
        nameEl.textContent = 'Convidado';
        avatarEl.src = 'https://minotar.net/helm/Steve/64';
        if (sideAvatar) { sideAvatar.src = 'https://minotar.net/helm/Steve/64'; sideAvatar.title = 'Convidado'; }
    }
}

// ── VERSIONS ─────────────────────────────────────────────────
const versionSelect = document.getElementById('version-select');

async function loadVersions() {
    if (!versionSelect) return;
    versionSelect.innerHTML = '<option disabled selected>A carregar...</option>';
    try {
        const { remote, installed } = await window.launcher.versions.getAll();
        versionSelect.innerHTML = '';

        if (installed && installed.length > 0) {
            const g = document.createElement('optgroup');
            g.label = '✓ Instaladas';
            installed.forEach(v => {
                const o = document.createElement('option');
                o.value = v.id;
                o.textContent = `${v.id}  [${v.type}]  ${formatBytes(v.size)}`;
                g.appendChild(o);
            });
            versionSelect.appendChild(g);
        }

        if (remote && remote.length > 0) {
            const installedIds = new Set((installed || []).map(v => v.id));
            const notInstalled = remote.filter(id => !installedIds.has(id));
            if (notInstalled.length > 0) {
                const g = document.createElement('optgroup');
                g.label = '⬇ Para descarregar';
                notInstalled.forEach(id => {
                    const o = document.createElement('option');
                    o.value = id; o.textContent = id;
                    g.appendChild(o);
                });
                versionSelect.appendChild(g);
            }
        }

        if (versionSelect.options.length === 0) {
            const o = document.createElement('option');
            o.value = '1.20.1'; o.textContent = '1.20.1';
            versionSelect.appendChild(o);
        }

        const statEl = document.getElementById('stat-versions-count');
        if (statEl) {
            const total = (installed ? installed.length : 0) + (remote ? remote.length : 0);
            statEl.textContent = total;
        }
    } catch (e) {
        console.error('Erro versões:', e);
        versionSelect.innerHTML = '<option value="1.20.1">1.20.1</option>';
    }
}

// ── PLAY ─────────────────────────────────────────────────────
const playBtn         = document.getElementById('play-btn');
const progressSection = document.getElementById('progress-section');
const progressFill    = document.getElementById('progress-fill');
const progressStatus  = document.getElementById('progress-status');
const progressPercent = document.getElementById('progress-percent');

function resetPlayButton() {
    if (!playBtn) return;
    playBtn.disabled = false;
    playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>JOGAR`;
    if (progressSection) progressSection.classList.add('hidden');
    if (progressFill) progressFill.style.width = '0%';
}

async function startGame() {
    const version = versionSelect ? versionSelect.value : '1.20.1';
    if (!version || version === 'A carregar...') return;
    playBtn.disabled = true;
    playBtn.innerHTML = '<span>A CARREGAR...</span>';
    if (progressSection) progressSection.classList.remove('hidden');
    if (progressFill)    progressFill.style.width = '0%';
    if (progressStatus)  progressStatus.textContent = 'A preparar...';
    if (progressPercent) progressPercent.textContent = '0%';
    try {
        const result = await window.launcher.minecraft.launch({ version });
        if (!result || !result.success) {
            alert('Erro ao iniciar: ' + (result && result.error ? result.error : 'Erro desconhecido'));
            resetPlayButton(); return;
        }
        if (progressStatus) progressStatus.textContent = 'Jogo iniciado!';
        setTimeout(resetPlayButton, 3000);
    } catch (err) {
        alert('Erro ao iniciar: ' + (err && err.message ? err.message : err));
        resetPlayButton();
    }
}

if (playBtn) playBtn.addEventListener('click', startGame);

if (window.launcher && window.launcher.on) {
    window.launcher.on.downloadProgress(data => {
        try {
            if (!data) return;
            const downloaded = typeof data.downloaded === 'number' ? data.downloaded : data.task;
            const total      = typeof data.total      === 'number' ? data.total      : data.size;
            if (!total || total <= 0 || !downloaded) return;
            const pct = Math.max(0, Math.min(100, Math.round((downloaded / total) * 100)));
            if (progressFill)    progressFill.style.width = pct + '%';
            if (progressStatus)  progressStatus.textContent = 'A descarregar ficheiros...';
            if (progressPercent) progressPercent.textContent = pct + '%';
        } catch (e) {}
    });
    window.launcher.on.gameLog(log => console.log('[MC]:', log));
}

// ── ACCOUNTS ─────────────────────────────────────────────────
const accountsList    = document.getElementById('accounts-list');
const addOfflineBtn   = document.getElementById('add-offline-btn');
const addMicrosoftBtn = document.getElementById('add-microsoft-btn');

// offline modal
const offlineModal   = document.getElementById('offline-modal');
const offlineInput   = document.getElementById('offline-username-input');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

function openOfflineModal() {
    if (!offlineModal) return;
    offlineInput.value = '';
    offlineModal.classList.add('open');
    setTimeout(() => offlineInput && offlineInput.focus(), 100);
}
function closeOfflineModal() { offlineModal && offlineModal.classList.remove('open'); }

if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeOfflineModal);
if (offlineModal)   offlineModal.addEventListener('click', e => { if (e.target === offlineModal) closeOfflineModal(); });
if (offlineInput)   offlineInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  modalConfirmBtn && modalConfirmBtn.click();
    if (e.key === 'Escape') closeOfflineModal();
});
if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', async () => {
        const username = offlineInput ? offlineInput.value.trim() : '';
        if (!username) { offlineInput && offlineInput.focus(); return; }
        modalConfirmBtn.disabled = true;
        modalConfirmBtn.textContent = 'A adicionar...';
        try {
            const res = await window.launcher.accounts.addOffline(username);
            if (!res || !res.success) throw new Error(res && res.error ? res.error : 'Erro');
            closeOfflineModal();
            await loadAccounts();
            const active = await window.launcher.accounts.getActive();
            if (active) updateProfileCard(active);
        } catch (error) {
            alert('Erro: ' + (error && error.message ? error.message : error));
        } finally {
            modalConfirmBtn.disabled = false;
            modalConfirmBtn.textContent = 'Adicionar';
        }
    });
}

async function loadAccounts() {
    if (!accountsList) return;
    try {
        const [accounts, activeAccount] = await Promise.all([
            window.launcher.accounts.get(),
            window.launcher.accounts.getActive()
        ]);
        accountsList.innerHTML = '';
        if (!accounts || accounts.length === 0) {
            accountsList.innerHTML = '<p>Nenhuma conta adicionada ainda.</p>';
            return;
        }
        const activeId = activeAccount ? activeAccount.id : null;
        accounts.forEach(account => {
            const isActive = account.id === activeId;
            const item = document.createElement('div');
            item.className = 'account-item' + (isActive ? ' active-account' : '');
            const safeName = escapeHtml(account.username);
            const safeType = escapeHtml(account.type || 'Offline');
            const safeId   = escapeHtml(account.id);
            item.innerHTML = `
                <img src="https://minotar.net/helm/${encodeURIComponent(account.username)}/64" alt="${safeName}" width="36" height="36" style="border-radius:8px;image-rendering:pixelated;background:var(--bg-mid)">
                <div style="flex:1;min-width:0">
                    <strong style="display:block;font-size:.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeName}</strong>
                    <small style="color:var(--text-muted);font-size:.75rem">${safeType}</small>
                </div>
                <span class="account-active-badge">✓ Ativa</span>
                ${!isActive ? `<button class="account-use-btn" data-account-id="${safeId}">Usar</button>` : ''}
                <button class="remove-account-btn" data-account-id="${safeId}" style="padding:6px 13px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.28);color:#fca5a5;font-family:inherit;font-size:.76rem;font-weight:600;border-radius:999px;cursor:pointer;transition:all .3s">Remover</button>
            `;
            accountsList.appendChild(item);
        });

        accountsList.querySelectorAll('.account-use-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = e.currentTarget.getAttribute('data-account-id');
                try {
                    const res = await window.launcher.accounts.setActive(id);
                    if (res && res.success) { updateProfileCard(res.account); await loadAccounts(); }
                } catch (err) { alert('Erro: ' + (err && err.message ? err.message : err)); }
            });
        });

        accountsList.querySelectorAll('.remove-account-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = e.currentTarget.getAttribute('data-account-id');
                try {
                    await window.launcher.accounts.remove(id);
                    await loadAccounts();
                    const newActive = await window.launcher.accounts.getActive();
                    updateProfileCard(newActive);
                } catch (err) { alert('Erro: ' + (err && err.message ? err.message : err)); }
            });
        });
    } catch (error) {
        console.error('Erro contas:', error);
        if (accountsList) accountsList.innerHTML = '<p>Erro ao carregar contas.</p>';
    }
}

if (addOfflineBtn)   addOfflineBtn.addEventListener('click', () => openOfflineModal());
if (addMicrosoftBtn) {
    addMicrosoftBtn.addEventListener('click', async () => {
        addMicrosoftBtn.disabled = true;
        addMicrosoftBtn.querySelector('span') && (addMicrosoftBtn.querySelector('span').textContent = 'A abrir...');
        try {
            const res = await window.launcher.accounts.addMicrosoft();
            if (!res || !res.success) throw new Error(res && res.error ? res.error : 'Erro');
            await loadAccounts();
            const active = await window.launcher.accounts.getActive();
            if (active) updateProfileCard(active);
        } catch (error) {
            alert('Erro Microsoft: ' + (error && error.message ? error.message : error));
        } finally {
            addMicrosoftBtn.disabled = false;
            if (addMicrosoftBtn.querySelector('span')) addMicrosoftBtn.querySelector('span').textContent = 'Microsoft';
        }
    });
}

// ── SCREENSHOTS ──────────────────────────────────────────────
const screenshotsGrid = document.getElementById('screenshots-grid');

async function loadScreenshots() {
    if (!screenshotsGrid) return;
    try {
        const screenshots = await window.launcher.screenshots.get();
        screenshotsGrid.innerHTML = '';
        if (!screenshots || screenshots.length === 0) {
            screenshotsGrid.innerHTML = '<p>Nenhuma screenshot encontrada.</p>'; return;
        }
        screenshots.slice(0, 24).forEach(p => {
            const item = document.createElement('div');
            item.className = 'screenshot-item';
            item.innerHTML = `<img src="file://${p}" alt="Screenshot">`;
            item.addEventListener('click', () => window.launcher.screenshots.open(p));
            screenshotsGrid.appendChild(item);
        });
    } catch (e) {
        screenshotsGrid.innerHTML = '<p>Erro ao carregar screenshots.</p>';
    }
}

// ── SETTINGS ─────────────────────────────────────────────────
const ramSetting      = document.getElementById('ram-setting');
const resSetting      = document.getElementById('resolution-setting');
const themeToggle     = document.getElementById('theme-toggle');
const opacitySetting  = document.getElementById('opacity-setting');
const opacityValue    = document.getElementById('opacity-value');
const bgColorSetting  = document.getElementById('bg-color-setting');
const colorPresets    = document.querySelectorAll('.color-preset');
const logoutBtn       = document.getElementById('logout-btn');

function applyBackground(opacity, color) {
    document.documentElement.style.setProperty('--bg-fill-opacity', (opacity / 100).toFixed(2));
    document.documentElement.style.setProperty('--bg-fill-color', color);
}
function setActivePreset(color) {
    colorPresets.forEach(p => p.classList.toggle('active', p.getAttribute('data-color') === color));
}

async function loadSettings() {
    try {
        const s = await window.launcher.settings.get();
        if (!s) return;
        if (ramSetting && s.ram !== undefined)           ramSetting.value       = s.ram;
        if (resSetting && s.resolution)                  resSetting.value       = s.resolution;
        if (themeToggle && s.theme !== undefined)        themeToggle.checked    = s.theme;
        const opacity = s.bgOpacity !== undefined ? s.bgOpacity : 92;
        const color   = s.bgColor   || '#070d1a';
        if (opacitySetting) opacitySetting.value = opacity;
        if (opacityValue)   opacityValue.textContent = opacity + '%';
        if (bgColorSetting) bgColorSetting.value = color;
        setActivePreset(color);
        applyBackground(opacity, color);
    } catch (e) { console.error('loadSettings:', e); }
}

async function saveSettings() {
    try {
        const opacity = opacitySetting ? parseInt(opacitySetting.value) : 92;
        const color   = bgColorSetting ? bgColorSetting.value : '#070d1a';
        await window.launcher.settings.set({
            ram:        ramSetting  ? parseInt(ramSetting.value)  : 4096,
            resolution: resSetting  ? resSetting.value            : '1920x1080',
            theme:      themeToggle ? !!themeToggle.checked       : true,
            bgOpacity:  opacity,
            bgColor:    color
        });
    } catch (e) { console.error('saveSettings:', e); }
}

if (ramSetting)     ramSetting.addEventListener('change', saveSettings);
if (resSetting)     resSetting.addEventListener('change', saveSettings);
if (themeToggle)    themeToggle.addEventListener('change', saveSettings);

if (opacitySetting) {
    opacitySetting.addEventListener('input', () => {
        const val = parseInt(opacitySetting.value);
        if (opacityValue) opacityValue.textContent = val + '%';
        applyBackground(val, bgColorSetting ? bgColorSetting.value : '#070d1a');
    });
    opacitySetting.addEventListener('change', saveSettings);
}

if (bgColorSetting) {
    bgColorSetting.addEventListener('input', () => {
        const c = bgColorSetting.value;
        applyBackground(opacitySetting ? parseInt(opacitySetting.value) : 92, c);
        setActivePreset(c);
    });
    bgColorSetting.addEventListener('change', saveSettings);
}

colorPresets.forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (bgColorSetting) bgColorSetting.value = color;
        applyBackground(opacitySetting ? parseInt(opacitySetting.value) : 92, color);
        setActivePreset(color);
        saveSettings();
    });
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (confirm('Tem a certeza que quer desconectar?')) {
            try {
                await window.launcher.account.clear();
                updateProfileCard(null);
                await loadAccounts();
            } catch (e) { console.error('logout:', e); }
        }
    });
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    resetPlayButton();
    await loadVersions();
    await loadJavaBadge();
    try {
        const active = await window.launcher.accounts.getActive();
        if (active) updateProfileCard(active);
    } catch (e) {}
});
