// 조작 창. Windows의 기본 제목줄 없이 띄우고, 앱의 메뉴줄(30px)이 제목줄을 겸한다.

import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { Logger } from '../log'

/** 디자인 시스템의 window-min-width, window-min-height */
const MIN_WIDTH = 1280
const MIN_HEIGHT = 720

export const preloadPath = join(__dirname, '../preload/index.js')

export function loadPage(win: BrowserWindow, page: 'index'): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer !== undefined && devServer.length > 0) void win.loadURL(`${devServer}/${page}.html`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

export function createControlWindow(log: Logger): BrowserWindow {
  const area = screen.getPrimaryDisplay().workAreaSize
  const win = new BrowserWindow({
    width: Math.max(MIN_WIDTH, Math.min(1920, area.width)),
    height: Math.max(MIN_HEIGHT, Math.min(1080, area.height)),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    title: 'LoveLight Presenter',
    backgroundColor: '#0e0e0e',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // 앱 밖으로 나가는 탐색과 새 창은 막는다.
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // 조작 창이 죽어도 출력은 메인이 들고 있으므로, 기록하고 다시 불러온다.
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('조작 창 프로세스가 끝났습니다', details)
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) loadPage(win, 'index')
  })

  win.once('ready-to-show', () => {
    if (area.width <= 1920 && area.height <= 1080) win.maximize()
    win.show()
  })
  loadPage(win, 'index')
  return win
}
