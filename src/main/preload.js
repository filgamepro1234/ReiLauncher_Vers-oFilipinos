// preload.js
const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = {
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close'
  },
  AUTH: {
    MICROSOFT: 'auth:microsoft',
    OFFLINE: 'auth:offline'
  },
  ACCOUNTS: {
    GET: 'accounts:get',
    GET_ACTIVE: 'account:getActive',
    ADD_OFFLINE: 'account:addOffline',
    ADD_MICROSOFT: 'account:addMicrosoft',
    SET_ACTIVE: 'account:setActive',
    REMOVE: 'account:remove'
  },
  JAVA: { DETECT: 'java:detect' },
  MINECRAFT: {
    DOWNLOAD: 'minecraft:download',
    LAUNCH: 'minecraft:launch'
  },
  VERSIONS: { GET: 'versions:get' },
  SCREENSHOTS: { GET: 'screenshots:get', OPEN: 'screenshots:open' },
  MODRINTH: { OPEN: 'modrinth:open' },
  SKINS: { OPEN_NAMEMC: 'skins:openNameMC' },
  INSTANCES: { GET: 'instances:get', CREATE: 'instances:create', DELETE: 'instances:delete' },
  SETTINGS: { GET: 'settings:get', SET: 'settings:set' },
  ACCOUNT: { GET: 'account:get', SET: 'account:set', CLEAR: 'account:clear' },
  EVENTS: { DOWNLOAD_PROGRESS: 'download:progress', GAME_LOG: 'game:log' }
};

// Helper para registar um listener e devolver uma função de unsubscribe
function subscribe(channel, callback) {
  const wrapped = (event, payload) => {
    try {
      callback(payload);
    } catch (err) {
      console.error('Erro no callback do renderer:', err);
    }
  };
  ipcRenderer.on(channel, wrapped);
  return () => {
    try {
      ipcRenderer.removeListener(channel, wrapped);
    } catch (e) {
      // ignore
    }
  };
}

contextBridge.exposeInMainWorld('launcher', {
  window: {
    minimize: () => ipcRenderer.send(CHANNELS.WINDOW.MINIMIZE),
    maximize: () => ipcRenderer.send(CHANNELS.WINDOW.MAXIMIZE),
    close:    () => ipcRenderer.send(CHANNELS.WINDOW.CLOSE)
  },
  auth: {
    microsoft: () => ipcRenderer.invoke(CHANNELS.AUTH.MICROSOFT),
    offline: (username) => ipcRenderer.invoke(CHANNELS.AUTH.OFFLINE, username)
  },
  accounts: {
    get: () => ipcRenderer.invoke(CHANNELS.ACCOUNTS.GET),
    getActive: () => ipcRenderer.invoke(CHANNELS.ACCOUNTS.GET_ACTIVE),
    addOffline: (username) => ipcRenderer.invoke(CHANNELS.ACCOUNTS.ADD_OFFLINE, username),
    addMicrosoft: () => ipcRenderer.invoke(CHANNELS.ACCOUNTS.ADD_MICROSOFT),
    setActive: (id) => ipcRenderer.invoke(CHANNELS.ACCOUNTS.SET_ACTIVE, id),
    remove: (id) => ipcRenderer.invoke(CHANNELS.ACCOUNTS.REMOVE, id)
  },
  java: {
    detect: () => ipcRenderer.invoke(CHANNELS.JAVA.DETECT),
    getVersion: () => ipcRenderer.invoke('java:getVersion')
  },
  minecraft: {
    download: (version) => ipcRenderer.invoke(CHANNELS.MINECRAFT.DOWNLOAD, version),
    launch:   (config)  => ipcRenderer.invoke(CHANNELS.MINECRAFT.LAUNCH, config)
  },
  versions: {
    get: () => ipcRenderer.invoke(CHANNELS.VERSIONS.GET),
    getAll: () => ipcRenderer.invoke('versions:getAll')
  },
  screenshots: {
    get: () => ipcRenderer.invoke(CHANNELS.SCREENSHOTS.GET),
    open: (filePath) => ipcRenderer.invoke(CHANNELS.SCREENSHOTS.OPEN, filePath)
  },
  modrinth: {
    open: () => ipcRenderer.invoke(CHANNELS.MODRINTH.OPEN)
  },
  skins: {
    openNameMC: (username) => ipcRenderer.invoke(CHANNELS.SKINS.OPEN_NAMEMC, username)
  },
  instances: {
    get:     ()     => ipcRenderer.invoke(CHANNELS.INSTANCES.GET),
    create: (data) => ipcRenderer.invoke(CHANNELS.INSTANCES.CREATE, data),
    delete: (id)   => ipcRenderer.invoke(CHANNELS.INSTANCES.DELETE, id)
  },
  settings: {
    get: ()     => ipcRenderer.invoke(CHANNELS.SETTINGS.GET),
    set: (data) => ipcRenderer.invoke(CHANNELS.SETTINGS.SET, data)
  },
  account: {
    get:   ()     => ipcRenderer.invoke(CHANNELS.ACCOUNT.GET),
    set:   (data) => ipcRenderer.invoke(CHANNELS.ACCOUNT.SET, data),
    clear: ()     => ipcRenderer.invoke(CHANNELS.ACCOUNT.CLEAR)
  },
  on: {
    downloadProgress: (callback) => subscribe(CHANNELS.EVENTS.DOWNLOAD_PROGRESS, callback),
    gameLog: (callback) => subscribe(CHANNELS.EVENTS.GAME_LOG, callback)
  }
});