const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pixelForge', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke('show-item-in-folder', targetPath),
  readUserSettings: () => ipcRenderer.invoke('read-user-settings'),
  writeUserSettings: (payload) => ipcRenderer.invoke('write-user-settings', payload),
  isElectron: true,
})
