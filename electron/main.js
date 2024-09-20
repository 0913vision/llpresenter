const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    // titleBarStyle: 'hidden',
  });

  mainWindow.loadURL('http://localhost:3000');
  // mainWindow.webContents.openDevTools();
}

app.on('ready', createWindow);
