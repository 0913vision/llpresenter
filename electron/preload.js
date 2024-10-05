// preload.js
'use strict';

const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  //font
  getFontList: () => ipcRenderer.invoke('get-font-list'),

  //file
  handleFileUpload: (callback) => ipcRenderer.on('lyrics_file_upload', callback),

  //menu
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

  //monitor
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  sendSceneDataToMonitor: (monitorId, sceneData) => ipcRenderer.send('set-scene-data', monitorId, sceneData),
  receiveSceneData: (callback) => ipcRenderer.on('set-scene-data', (event, data) => callback(data)),

  //preview window
  getExportWindows: () => ipcRenderer.invoke('get-export-windows'),
  desktopCaptureGetSources: async () => {
    return await desktopCapturer.getSources({ types: ['window'] }); 
  },

  //scene setup
  openSceneSetup: (data) => ipcRenderer.send('open-scene-setup', data),
  initialSceneSetup: (callback) => ipcRenderer.on('initial-scene-setup', (event, data) => callback(data)),
  sendUpdatedSceneData: (data) => ipcRenderer.send('scene-setup-data', data),
  receiveUpdatedSceneData: (callback) => ipcRenderer.on('scene-setup-data', (event, data) => callback(data)),

  //showing
  sendLyrics: (data) => ipcRenderer.send('show-lyrics-data', data),
  receiveLyrics: (callback) => ipcRenderer.on('show-lyrics-data', (event, data) => callback(data)),
});
