const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize:     () => ipcRenderer.send('window-minimize'),
  maximize:     () => ipcRenderer.send('window-maximize'),
  close:        () => ipcRenderer.send('window-close'),
  isMaximized:  () => ipcRenderer.invoke('is-maximized'),
  onMaximized:  (cb) => ipcRenderer.on('maximized',  (_, v) => cb(v)),
  onFocused:    (cb) => ipcRenderer.on('focused',    (_, v) => cb(v)),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  isElectron:   true,

  // ─── Auto-update events (UI customizada no renderer) ───
  onUpdateAvailable:  (cb) => ipcRenderer.on('update:available',  (_, info) => cb(info)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update:progress',   (_, p)    => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_, info) => cb(info)),
  onUpdateError:      (cb) => ipcRenderer.on('update:error',      (_, msg)  => cb(msg)),
  installUpdate:      () => ipcRenderer.send('update:install'),
  dismissUpdate:      () => ipcRenderer.send('update:dismiss'),
  getAppVersion:      () => ipcRenderer.invoke('get-app-version'),
});
