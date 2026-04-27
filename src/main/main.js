// main.js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ejse = require('ejs-electron');
ejse.options('root', path.join(__dirname, '../renderer'));
const store = require('./store/store.js');

const { createOfflineAccount } = require('./auth/offline.js');
const { authenticateMicrosoft } = require('./auth/microsoft.js');
const { getRemoteVersions, getInstalledVersions } = require('./launcher/versions.js');
const { launchGame } = require('./launcher/mcl-core.js');
const { detectJava, getJavaVersion } = require('./launcher/java.js');

const MINECRAFT_DIR = path.join(app.getPath('userData'), '.rei-launcher');

let mainWindow;

async function createWindow() {
    const remoteVersions = await getRemoteVersions();
    const account = store.get('account') || null;

    ejse.data({
        account,
        settings: store.get('settings') || { ram: 4096 },
        remoteVersions: remoteVersions.slice(0, 5) // only used as SSR placeholder
    });

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.ejs'));
}

// --- WINDOW ---
ipcMain.on('window:close', () => app.quit());
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});

// --- MINECRAFT LAUNCH ---
ipcMain.handle('minecraft:launch', async (event, { version }) => {
    try {
        const result = await launchGame(
            version,
            (progress) => mainWindow.webContents.send('download:progress', progress),
            (log) => mainWindow.webContents.send('game:log', log)
        );
        return result;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// --- ACCOUNTS ---
ipcMain.handle('accounts:get', async () => store.get('accounts') || []);
ipcMain.handle('account:getActive', async () => store.get('account') || null);

ipcMain.handle('account:addOffline', async (event, username) => {
    try {
        const res = await createOfflineAccount(username);
        if (res.success) {
            const accounts = store.get('accounts') || [];
            accounts.push(res.account);
            store.set('accounts', accounts);
            if (!store.get('account')) store.set('account', res.account);
        }
        return res;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('account:addMicrosoft', async () => {
    try {
        const res = await authenticateMicrosoft();
        if (res.success) {
            const accounts = store.get('accounts') || [];
            const existing = accounts.findIndex(a => a.id === res.account.id);
            if (existing >= 0) {
                accounts[existing] = res.account;
            } else {
                accounts.push(res.account);
            }
            store.set('accounts', accounts);
            if (!store.get('account')) store.set('account', res.account);
        }
        return res;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('account:setActive', async (event, id) => {
    try {
        const accounts = store.get('accounts') || [];
        const account = accounts.find(a => a.id === id);
        if (account) {
            store.set('account', account);
            return { success: true, account };
        }
        return { success: false, error: 'Conta não encontrada' };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('account:remove', async (event, id) => {
    try {
        let accounts = store.get('accounts') || [];
        accounts = accounts.filter(a => a.id !== id);
        store.set('accounts', accounts);
        const active = store.get('account');
        if (active && active.id === id) {
            store.delete('account');
            // Set next available account as active
            if (accounts.length > 0) store.set('account', accounts[0]);
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('account:clear', async () => {
    store.delete('account');
    return { success: true };
});

// --- VERSIONS ---
ipcMain.handle('versions:get', async () => {
    try { return await getRemoteVersions(); }
    catch (err) { return ['1.21.4', '1.20.1']; }
});

ipcMain.handle('versions:getAll', async () => {
    try {
        const [remote, installed] = await Promise.all([
            getRemoteVersions(),
            Promise.resolve(getInstalledVersions(MINECRAFT_DIR))
        ]);
        return { remote, installed };
    } catch (err) {
        return { remote: ['1.21.4', '1.20.1'], installed: [] };
    }
});

// --- JAVA ---
ipcMain.handle('java:detect', async () => {
    try {
        const javaPath = await detectJava();
        return { path: javaPath };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('java:getVersion', async () => {
    try {
        const version = getJavaVersion();
        return { version };
    } catch (err) {
        return { version: null };
    }
});

// --- SCREENSHOTS ---
ipcMain.handle('screenshots:get', async () => {
    try {
        const mcFolder = process.platform === 'win32' ? 'AppData/Roaming/.minecraft' : '.minecraft';
        const screenshotsDir = path.join(app.getPath('home'), mcFolder, 'screenshots');
        if (!fs.existsSync(screenshotsDir)) return [];
        return fs.readdirSync(screenshotsDir)
            .filter(file => /\.(png|jpg|jpeg)$/i.test(file))
            .map(file => path.join(screenshotsDir, file))
            .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);
    } catch (err) {
        return [];
    }
});

ipcMain.handle('screenshots:open', async (event, filePath) => {
    try { shell.openPath(filePath); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});

// --- SETTINGS ---
ipcMain.handle('settings:get', async () => store.get('settings') || { ram: 4096 });
ipcMain.handle('settings:set', async (event, settings) => {
    try {
        store.set('settings', settings);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// --- INIT ---
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});