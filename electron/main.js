const { app, BrowserWindow, Menu, dialog, ipcMain, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const font_list_module = require('font-list')
let system_font_list_kr = null;
if(os.platform() === 'win32') {
  system_font_list_kr = require('system-font-list-kr');
}

let fontList = null;
let mainWindow;
let lyricsEditWindow;
let exportWindows = {};
let screens;
let sceneSetupModal;

const getFontList = async () => {
  try {
    if (os.platform() === 'win32') {
      const fonts = await system_font_list_kr.getFonts({disableQuoting: true});
      return fonts;
    }
    else {
      const fonts = await font_list_module.getFonts({disableQuoting: true});
      return fonts;
    }
  } catch (err) {
    console.error(err);
  }
};
fontList = getFontList();

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

function createWindow({ width = 800, height = 600, url = '/', options = {} }) {
  const window = new BrowserWindow({
    width: width,
    height: height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      ...options.webPreferences
    },
    ...options
  });

  window.loadURL(`http://localhost:3000/#${url}`);

  return window;
}

function createMainWindow () {
  mainWindow = createWindow({
    width: 1920,
    height: 1080,
    url: '/',
    show: false,
  });
  setAppMenu();
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.setTitle('LoveLight Presenter');
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    for (let id in exportWindows) {
      const win = exportWindows[id];
      win.destroy(); // 창 강제 종료
    }
    app.quit();
  });
}

function createLyricsEditWindow(data) {
  lyricsEditWindow = createWindow({
    width: 400,
    height: 500,
    url: `/lyricsEditWindow`, // 이 URL을 실제 파일 경로로 변경
    options: {
      title: 'Lyrics Editor',
      parent: mainWindow, 
      modal: true, 
      show: false,
      maximizable: false,
      minimizable: false,
    }
  });

  lyricsEditWindow.webContents.openDevTools();
  lyricsEditWindow.removeMenu(); 

  // 데이터 전송
  lyricsEditWindow.webContents.once('did-finish-load', () => {
    lyricsEditWindow.setTitle('슬라이드 수정');
    lyricsEditWindow.webContents.send('lyrics-data-to-edit-window', data);
    lyricsEditWindow.show();
  });

  lyricsEditWindow.on('close', () => {
    lyricsEditWindow = null;
    if (mainWindow) {
      mainWindow.focus();  // 메인 윈도우로 포커스 강제 설정
    }
  });
}

ipcMain.on('open-lyrics-edit', (event, data) => {
  createLyricsEditWindow(data);
});
ipcMain.on('edited-lyrics-data', (event, data) => {
  if(mainWindow) {
    mainWindow.webContents.send('edited-lyrics-data', data);
  }
});

function createLyricsAddWindow(data) {
  lyricsAddWindow = createWindow({
    width: 400,
    height: 500,
    url: `/lyricsAddWindow`, // 이 URL을 실제 파일 경로로 변경
    options: {
      title: 'Lyrics Editor',
      parent: mainWindow, 
      modal: true, 
      show: false,
      maximizable: false,
      minimizable: false,
    }
  });

  // lyricsAddWindow.webContents.openDevTools();
  lyricsAddWindow.removeMenu(); 

  // 데이터 전송
  lyricsAddWindow.webContents.once('did-finish-load', () => {
    lyricsAddWindow.setTitle('슬라이드 추가');
    lyricsAddWindow.show();
  });

  lyricsAddWindow.on('close', () => {
    lyricsAddWindow = null;
    if (mainWindow) {
      mainWindow.focus();  // 메인 윈도우로 포커스 강제 설정
    }
  });
}

ipcMain.on('open-lyrics-add', (event, data) => {
  createLyricsAddWindow(data);
});
ipcMain.on('new-lyrics-data', (event, data) => {
  if(mainWindow) {
    mainWindow.webContents.send('new-lyrics-data', data);
  }
});

function createSceneSetupModal(data) {
  sceneSetupModal = createWindow({
    width: 365,
    height: 510,
    url: `/sceneSetupWindow`,
    options: {
      parent: mainWindow,
      modal: true,
      show: false,
      maximizable: false,
      minimizable: false,
    }
  });

  sceneSetupModal.removeMenu();

  sceneSetupModal.webContents.once('did-finish-load', () => {
    sceneSetupModal.setTitle('씬 수정');
    sceneSetupModal.webContents.send('initial-scene-setup', data);
    sceneSetupModal.show();
  });

  sceneSetupModal.on('close', () => {
    sceneSetupModal = null;
    if(mainWindow) {
      mainWindow.focus();
    }
  });
}

ipcMain.on('open-scene-setup', (event, data) => {
  createSceneSetupModal(data);
});

ipcMain.on('scene-setup-data', (event, data) => {
  if(mainWindow) {
    mainWindow.webContents.send('scene-setup-data', data);
  }
});


// 기본 메뉴 설정 함수
function getDefaultMenuTemplate() {
  return [
    {
      label: 'File',
      submenu: [
        { 
          label: 'lyrics 열기', 
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Text Files', extensions: ['txt'] },
              ]
            });
            if (!result.canceled) {
              const filePath = result.filePaths[0];
              const fileName = path.basename(filePath);

              fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                  console.error('파일을 읽는 중 오류 발생:', err);
                  return;
                }
                // 파일 내용을 React로 전송
                mainWindow.webContents.send('lyrics_file_upload', fileName, data);
              });
            }},
          accelerator: 'CmdOrCtrl+O'
        },
        { 
          label: 'Save', 
          click: () => { console.log('Save Clicked'); }, 
          accelerator: 'CmdOrCtrl+S' 
        },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, 
        { role: 'forceReload' }, 
        { role: 'toggleDevTools' } 
      ]
    }
  ];
}

// 메뉴 설정 함수
function setAppMenu(customMenu = []) {
  const defaultMenu = getDefaultMenuTemplate();
  const menuTemplate = [...defaultMenu, ...customMenu];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createMainWindow);
app.whenReady().then(() => {
  screens = screen.getAllDisplays().slice(1, screen.getAllDisplays().length);
  screens.forEach((display, index) => createWindowForMonitor(display, index+1));
})
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {  // 'media'는 카메라 및 마이크에 대한 권한 요청을 의미
      callback(true); // 자동으로 권한을 허용
    }
  });
});

app.on('window-all-closed', () => {
  // if (process.platform !== 'darwin') {
    app.quit();
  // }
});

// 컴포넌트에서 메뉴를 추가 또는 수정하도록 요청할 때 사용
ipcMain.on('update-component-menu', (event, customMenu) => {
  setAppMenu(customMenu); // 컴포넌트에서 전달된 메뉴 항목 추가
});


// 모니터 처리 로직
ipcMain.handle('get-displays', () => {
  const displays = screens.map((display) => ({
    id: display.id,
    name: display.label || `Display ${display.id} (${display.size.width}x${display.size.height})`,
  }));
  return displays;
});

ipcMain.on('set-scene-data', (event, monitorId, sceneData) => {
  // console.log(monitorId, sceneData);
  const win = exportWindows[monitorId]; // 모니터 ID로 윈도우 가져옴
  if (win) {
    win.webContents.send('set-scene-data', sceneData); // 창으로 씬 데이터 전송
  }
});

function createWindowForMonitor(display, index) {
  const win = createWindow({
    url: `/sceneRenderer`,
    options: {
      // title: `Export Window - ${display.id}`,
      // parent: mainWindow,
      closable: false,
      x: display.bounds.x,
      y: display.bounds.y,
      movable: false,
      fullscreen: true,
      maximizable: false,
      minimizable: false,
    }
  });
  exportWindows[display.id] = win; // 모니터 ID로 윈도우를 저장
  win.on('close', (event) => {
    event.preventDefault();  // 창 닫기 방지
  });

  win.webContents.once('did-finish-load', () => {
    win.setTitle(`Screen ${index}`);
    win.removeMenu(); 
    // win.maximize();
    win.webContents.openDevTools();
    // win.fullScreen = true;
    // console.log(win.id);
  });
}

ipcMain.handle('get-export-windows', () => {
  return Object.keys(exportWindows)
    .map(id => ({
      id, 
      title: exportWindows[id].getTitle(),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
});

ipcMain.on('show-lyrics-data', (event, data) => {
  for (let id in exportWindows) {
    exportWindows[id].webContents.send('show-lyrics-data', data);
  }
});