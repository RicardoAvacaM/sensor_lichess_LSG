const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openHtbAcademyLogin: () => ipcRenderer.invoke('htb:open-login'),
  isElectron: true,
});
