'use strict';
const { ipcMain } = require('electron');
const { getFontList } = require('./getFontList');

// Font List 핸들러
const handleFontList = (fontList) => {
  ipcMain.handle('get-font-list', async () => {
    if (!fontList) {
      try {
        fontList = await getFontList();
      } catch (err) {
        console.error(err);
      }
    }
    return fontList;
  });
};

// Lyrics 핸들러
const handleLyricsEvents = (createLyricsEditWindow, createLyricsAddWindow, mainWindow) => {
  ipcMain.on('open-lyrics-edit', (event, data) => {
    const lyricsEditWindow = createLyricsEditWindow(data);
  });

  ipcMain.on('edited-lyrics-data', (event, data) => {
    if(mainWindow) {
      mainWindow.webContents.send('edited-lyrics-data', data);
    }
  });

  ipcMain.on('open-lyrics-add', (event, data) => {
    const lyricsAddWindow = createLyricsAddWindow(data);
  });

  ipcMain.on('new-lyrics-data', (event, data) => {
    if(mainWindow) {
      mainWindow.webContents.send('new-lyrics-data', data);
    }
  });
};

// Scene Setup 핸들러
const handleSceneSetupEvents = (createSceneSetupModal, mainWindow) => {
  ipcMain.on('open-scene-setup', (event, data) => {
    const sceneSetupModal = createSceneSetupModal(data);
  });

  ipcMain.on('scene-setup-data', (event, data) => {
    if(mainWindow) {
      mainWindow.webContents.send('scene-setup-data', data);
    }
  });
};

// Monitor & Scene Data 핸들러
const handleMonitorEvents = (screens, exportWindows) => {
  ipcMain.handle('get-displays', () => {
    const displays = screens.map((display) => ({
      id: display.id,
      name: display.label || `Display ${display.id} (${display.size.width}x${display.size.height})`,
    }));
    return displays;
  });

  ipcMain.on('set-scene-data', (event, monitorId, sceneData) => {
    const win = exportWindows[monitorId];
    if (win) {
      win.webContents.send('set-scene-data', sceneData);
    }
  });

  ipcMain.handle('get-export-windows', () => {
    return Object.keys(exportWindows)
      .map(id => ({
        id, 
        title: exportWindows[id].getTitle(),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  });
};

// Export 데이터 핸들러
const handleExportWindows = (exportWindows) => {
  ipcMain.on('show-lyrics-data', (event, data) => {
    for (let id in exportWindows) {
      exportWindows[id].webContents.send('show-lyrics-data', data);
    }
  });
};

// 모든 핸들러를 초기화하는 함수
const initializeIpcHandlers = (dependencies) => {
  const {
    fontList,
    createLyricsEditWindow,
    createLyricsAddWindow,
    mainWindow,
    createSceneSetupModal,
    screens,
    exportWindows
  } = dependencies;

  handleFontList(fontList);
  handleLyricsEvents(createLyricsEditWindow, createLyricsAddWindow, mainWindow);
  handleSceneSetupEvents(createSceneSetupModal, mainWindow);
  handleMonitorEvents(screens, exportWindows);
  handleExportWindows(exportWindows);
};

module.exports = { initializeIpcHandlers };
