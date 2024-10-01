// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  handleFileUpload: (callback) => ipcRenderer.on('lyrics_file_upload', callback),
  setComponentMenu: (customMenu) => ipcRenderer.send('set-component-menu', customMenu),

  //lyrics modal
  openLyricsEdit: (data) => ipcRenderer.send('open-lyrics-edit', data),
  receiveLyricsToEdit: (callback) => ipcRenderer.on('lyrics-data-to-edit-window', (event, data) => callback(data)),
  sendEditedLyricsData: (data) => ipcRenderer.send('edited-lyrics-data', data),
  receiveEditedLyricsData: (callback) => ipcRenderer.on('edited-lyrics-data', (event, data) => callback(data)),

  //lyrics add modal
  openLyricsAdd: () => ipcRenderer.send('open-lyrics-add'),
  sendNewLyricsData: (data) => ipcRenderer.send('new-lyrics-data', data),
  receiveNewLyricsData: (callback) => ipcRenderer.on('new-lyrics-data', (event, data) => callback(data)),

  //color modal
  openColorModal: (data) => ipcRenderer.send('open-color-modal', data),
  receiveColorToEdit: (callback) => ipcRenderer.on('color-to-color-window', (event, data) => callback(data)),
  sendEditedColor: (data) => ipcRenderer.send('edited-color-data', data),
  receiveEditedColor: (callback) => ipcRenderer.on('edited-color-data', (event, data) => callback(data)),

  //monitor
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  sendSceneDataToMonitor: (monitorId, sceneData) => ipcRenderer.send('set-scene-data', monitorId, sceneData),
  receiveSceneData: (callback) => ipcRenderer.on('set-scene-data', (event, data) => callback(data)),
});
