// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  handleFileUpload: callback => ipcRenderer.on('lyrics_file_upload', callback),
  // disableMenuShortcuts: () => ipcRenderer.send('disable-menu-shortcuts'),
  // enableMenuShortcuts: () => ipcRenderer.send('enable-menu-shortcuts'),
  setComponentMenu: (menuName) => ipcRenderer.send('set-component-menu', menuName),
});
