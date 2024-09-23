// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  handleFileUpload: callback => ipcRenderer.on('lyrics_file_upload', callback),
  setComponentMenu: (customMenu) => ipcRenderer.send('set-component-menu', customMenu),
  openLyricsEdit: (data) => ipcRenderer.send('open-lyrics-edit', data),
  onEditLyricsData: (callback) => ipcRenderer.on('edit_lyrics_data', (event, data) => callback(data)),
});
