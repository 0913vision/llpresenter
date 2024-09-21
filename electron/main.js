const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow; // 전역 변수로 mainWindow 설정

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    },
    // titleBarStyle: 'hidden',
  });

  mainWindow.loadURL('http://localhost:3000');
  // mainWindow.webContents.openDevTools();

  setAppMenu(); // 초기 메뉴 설정
}

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
/*
let storedAccelerators = new Map(); 

// Electron 메뉴 단축키 비활성화
function disableMenuShortcuts() {
  const currentMenu = Menu.getApplicationMenu();
  if (currentMenu) {
    currentMenu.items.forEach(menuItem => {
      menuItem.submenu.items.forEach(subItem => {
        if (subItem.accelerator) {
          console.log(subItem.label, subItem.accelerator);
          storedAccelerators.set(subItem.label, subItem.accelerator);
          subItem.accelerator = null;
        }
      });
    });
  }
  Menu.setApplicationMenu(currentMenu);
}

// Electron 메뉴 단축키 활성화
function enableMenuShortcuts() {
  const currentMenu = Menu.getApplicationMenu();
  if (currentMenu) {
    currentMenu.items.forEach(menuItem => {
      menuItem.submenu.items.forEach(subItem => {
        if (storedAccelerators.has(subItem.label)) {
          subItem.accelerator = storedAccelerators.get(subItem.label);
        }
      });
    });
    Menu.setApplicationMenu(currentMenu);
    storedAccelerators.clear();
  }
}
*/

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/*
// IPC 통신을 통해 ContextMenuProvider와 연결
ipcMain.on('disable-menu-shortcuts', () => {
  disableMenuShortcuts(); // 메뉴 단축키 비활성화
});

ipcMain.on('enable-menu-shortcuts', () => {
  enableMenuShortcuts(); // 메뉴 단축키 활성화
});
*/

// 컴포넌트에서 메뉴를 추가 또는 수정하도록 요청할 때 사용
ipcMain.on('update-component-menu', (event, customMenu) => {
  setAppMenu(customMenu); // 컴포넌트에서 전달된 메뉴 항목 추가
});