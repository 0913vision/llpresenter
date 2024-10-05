const { Menu, ipcMain } = require('electron');
const { getVideoMetadataWithThumbnails, getTxtDataAsync } = require('./fileDialogModules');

// 기본 메뉴 설정 함수
function getDefaultMenuTemplate(mainWindow) {
  return [
    {
      label: 'File',
      submenu: [
        { 
          label: 'lyrics 열기', 
          click: async () => {
              const [fileName, data] = await getTxtDataAsync();
              
              mainWindow.webContents.send('lyrics_file_upload', fileName, data);
            },
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
function setAppMenu(mainWindow, customMenu = []) {
  const defaultMenu = getDefaultMenuTemplate(mainWindow);
  const menuTemplate = [...defaultMenu, ...customMenu];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

module.exports = { getDefaultMenuTemplate, setAppMenu };