const { app, ipcMain, screen, session } = require('electron');

const { getFontList } = require('./getFontList');
const { createMainWindow, createLyricsEditWindow, createLyricsAddWindow, createSceneSetupModal, createWindowForMonitor } = require('./windowModules');
const { setAppMenu } = require('./menuFunctions');
const { initializeIpcHandlers } = require('./ipcHandlers');  // 핸들러 모듈 추가

let fontList = null;
let mainWindow;
let exportWindows = {};
let screens;

fontList = getFontList();

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {  // 'media'는 카메라 및 마이크에 대한 권한 요청을 의미
      callback(true); // 자동으로 권한을 허용
    }
  });
  screens = screen.getAllDisplays().slice(1, screen.getAllDisplays().length);
  screens.forEach((display, index) => {
    const ew = createWindowForMonitor(display, index+1)
    exportWindows = {...exportWindows, ...ew};
  });
  mainWindow = createMainWindow(exportWindows);

  initializeIpcHandlers({
    fontList,
    createLyricsEditWindow,
    createLyricsAddWindow,
    mainWindow,
    createSceneSetupModal,
    screens,
    exportWindows
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// 컴포넌트에서 메뉴를 추가 또는 수정하도록 요청할 때 사용
// ipcMain.on('update-component-menu', (event, customMenu) => {
//   setAppMenu(customMenu); // 컴포넌트에서 전달된 메뉴 항목 추가
// }); 
// deprecated and it will be moved to ipcHandlers.js (to be modified)