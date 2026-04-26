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
});
