const { BrowserWindow, app } = require('electron');
const { setAppMenu } = require('./menuFunctions');
const path = require('path');

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

function createMainWindow (exportWindows) {
  const mainWindow = createWindow({
    width: 1920,
    height: 1080,
    url: '/',
    show: false,
  });
  mainWindow.setTitle('LoveLight Presenter');
  setAppMenu(mainWindow);
  
  mainWindow.webContents.once('did-finish-load', () => {
    // mainWindow.setTitle('LoveLight Presenter');
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    for (let id in exportWindows) {
      const win = exportWindows[id];
      win.destroy(); // 창 강제 종료
    }
    app.quit();
  });
  return mainWindow;
}

function createLyricsEditWindow(data) {
  const lyricsEditWindow = createWindow({
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

  lyricsEditWindow.setTitle('슬라이드 수정');
  // lyricsEditWindow.webContents.openDevTools();
  lyricsEditWindow.removeMenu(); 

  // 데이터 전송
  lyricsEditWindow.webContents.once('did-finish-load', () => {
    // lyricsEditWindow.setTitle('슬라이드 수정');
    lyricsEditWindow.webContents.send('lyrics-data-to-edit-window', data);
    lyricsEditWindow.show();
  });

  lyricsEditWindow.on('close', () => {
    lyricsEditWindow = null;
    if (mainWindow) {
      mainWindow.focus();  // 메인 윈도우로 포커스 강제 설정
    }
  });
  return lyricsEditWindow;
}

function createLyricsAddWindow(data) {
  const lyricsAddWindow = createWindow({
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

  lyricsAddWindow.setTitle('슬라이드 추가');
  // lyricsAddWindow.webContents.openDevTools();
  lyricsAddWindow.removeMenu(); 

  // 데이터 전송
  lyricsAddWindow.webContents.once('did-finish-load', () => {
    // lyricsAddWindow.setTitle('슬라이드 추가');
    lyricsAddWindow.show();
  });

  lyricsAddWindow.on('close', () => {
    lyricsAddWindow = null;
    if (mainWindow) {
      mainWindow.focus();  // 메인 윈도우로 포커스 강제 설정
    }
  });

  return lyricsAddWindow;
}

function createSceneSetupModal(data) {
  const sceneSetupModal = createWindow({
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
  sceneSetupModal.setTitle('씬 수정');
  sceneSetupModal.removeMenu();

  sceneSetupModal.webContents.once('did-finish-load', () => {
    // sceneSetupModal.setTitle('씬 수정');
    sceneSetupModal.webContents.send('initial-scene-setup', data);
    sceneSetupModal.show();
  });

  sceneSetupModal.on('close', () => {
    sceneSetupModal = null;
    if(mainWindow) {
      mainWindow.focus();
    }
  });

  return sceneSetupModal;
}

function createWindowForMonitor(display, index) {
  const win = createWindow({
    url: `/sceneRenderer`,
    options: {
      title: `Export Window - ${display.id}`,
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
  win.setTitle(`Screen ${index}`);

  win.on('close', (event) => {
    event.preventDefault();  // 창 닫기 방지
  });

  win.webContents.once('did-finish-load', () => {
    // win.setTitle(`Screen ${index}`);
    win.removeMenu(); 
    // win.maximize();
    win.webContents.openDevTools();
    // win.fullScreen = true;
    // console.log(win.id);
  });
  return { [display.id]: win };
}

module.exports = { createMainWindow, createLyricsEditWindow, createLyricsAddWindow, createSceneSetupModal, createWindowForMonitor };