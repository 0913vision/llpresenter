// 보드마다 화면에 보이는 글자를 뽑아 logs/text-<이름>.txt로 저장한다. 설명 문구 점검용.
// 사용: electron dump-text.js <보드 파일>...
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const files = process.argv.slice(process.argv.findIndex((a) => a.endsWith('dump-text.js')) + 1)
app.setPath('userData', path.join(require('os').tmpdir(), 'llp-dump-' + process.pid))
app.disableHardwareAcceleration()
setTimeout(() => app.quit(), 240000)
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, webPreferences: { offscreen: true } })
  fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true })
  for (const file of files) {
    await win.loadURL('http://localhost:5199/view.html?fit=0&f=' + encodeURIComponent(file))
    const text = await win.webContents.executeJavaScript(`new Promise((done) => {
      const check = () => document.body.dataset.ready ? done(document.getElementById('stage').innerText) : setTimeout(check, 50)
      check()
    })`)
    fs.writeFileSync(path.join(__dirname, 'logs', 'text-' + path.basename(file, '.dc.html') + '.txt'), text)
  }
  app.quit()
})
