const { app, BrowserWindow, Menu, dialog, ipcMain, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let lyricsEditWindow;
let colorModal;
let exportWindows = {};
let screens;

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
    width: 1400,
    height: 800,
    url: '/',
    show: false,
  });
  setAppMenu();
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.setTitle('LoveLight Presenter');
    mainWindow.show();
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


function createColorModal(data) {
  colorModal = createWindow({
    width: 500,
    height: 500,
    url: `/colorModal`,
    options: {
      title: 'Color Picker',
      parent: lyricsEditWindow,
      modal: true,
      show: false,
      maximizable: false,
      minimizable: false,
    }
  });

  colorModal.removeMenu(); 

  colorModal.webContents.once('did-finish-load', () => {
    colorModal.setTitle('색깔 수정');
    colorModal.webContents.send('color-to-color-window', data);
    colorModal.show();
  });

  colorModal.on('close', () => {
    colorModal = null;
    if(lyricsEditWindow) {
      lyricsEditWindow.focus();
    }
  });
}

ipcMain.on('open-color-modal', (event, data) => {
  createColorModal(data);
});

ipcMain.on('edited-color-data', (event, data) => {
  if(lyricsEditWindow) {
    lyricsEditWindow.webContents.send('edited-color-data', data);
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
  screens.forEach((display) => createWindowForMonitor(display));
})
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {  // 'media'는 카메라 및 마이크에 대한 권한 요청을 의미
      callback(true); // 자동으로 권한을 허용
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
  console.log(monitorId, sceneData);
  const win = exportWindows[monitorId]; // 모니터 ID로 윈도우 가져옴
  if (win) {
    win.webContents.send('set-scene-data', sceneData); // 창으로 씬 데이터 전송
  }
});

function createWindowForMonitor(display) {
  const win = createWindow({
    fullscreen: true,
    url: `/sceneRenderer`,
    options: {
      parent: mainWindow,
      closable: false,
      x: display.bounds.x,
      y: display.bounds.y,
      movable: false,
      fullscreen: true,
    }
  });
  win.removeMenu(); 
  win.webContents.openDevTools();
  // win.fullScreen = true;
  win.on('close', (event) => {
    event.preventDefault();  // 창 닫기 방지
  });

  exportWindows[display.id] = win; // 모니터 ID로 윈도우를 저장
}

