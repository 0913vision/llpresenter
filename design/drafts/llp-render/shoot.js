// 로컬 서버의 보드를 캡처해 PNG로 저장한다.
// 사용: electron shoot.js <보드 파일> <출력 폴더> [배율] [이름:x,y,w,h ...]
// 영역을 주지 않으면 보드 전체를 저장한다. 영역 좌표는 보드 기준(배율 적용 전) 픽셀이다.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(process.argv.findIndex((a) => a.endsWith('shoot.js')) + 1)
const [file, outDir, zoomArg, ...regions] = args
const zoom = Number(zoomArg || 1)
const logFile = path.join(__dirname, 'logs', 'shoot-' + path.basename(file || 'x', '.dc.html') + '.log')
fs.mkdirSync(path.dirname(logFile), { recursive: true })
fs.writeFileSync(logFile, '')
const log = (...a) => fs.appendFileSync(logFile, a.join(' ') + '\n')
process.on('uncaughtException', (e) => { log('error', e.stack); app.quit() })
process.on('unhandledRejection', (e) => { log('error', e && e.stack); app.quit() })

// 페이지 오류로 준비 신호가 오지 않으면 멈추지 않고 끝낸다.
setTimeout(() => { log('error', 'timeout'); app.quit() }, 30000)
app.setPath('userData', path.join(require('os').tmpdir(), 'llp-shoot-' + process.pid))
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, useContentSize: true, webPreferences: { offscreen: true, zoomFactor: zoom } })
  await win.loadURL('http://localhost:5199/view.html?fit=0&f=' + encodeURIComponent(file))
  // 배율은 출처별로 기억되므로 매번 다시 지정한다.
  win.webContents.setZoomFactor(zoom)
  const size = await win.webContents.executeJavaScript(`new Promise((done) => {
    const check = () => {
      if (document.body.dataset.ready) {
        const s = document.getElementById('stage')
        done({ w: s.scrollWidth, h: s.scrollHeight })
      } else setTimeout(check, 50)
    }
    check()
  })`)
  win.setContentSize(Math.ceil(size.w * zoom), Math.ceil(size.h * zoom))
  await new Promise((r) => setTimeout(r, 600))
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.basename(file, '.dc.html')
  const shots = regions.length ? regions : ['full=0,0,' + size.w + ',' + size.h]
  for (const spec of shots) {
    const [name, rect] = spec.split('=')
    const [x, y, w, h] = rect.split(',').map(Number)
    const img = await win.webContents.capturePage({ x: Math.round(x * zoom), y: Math.round(y * zoom), width: Math.round(w * zoom), height: Math.round(h * zoom) })
    const out = path.join(outDir, base + '-' + name + '.png')
    fs.writeFileSync(out, img.toPNG())
    log('wrote', out)
  }
  app.quit()
})
