const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pixelForge', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  isElectron: true,
})
