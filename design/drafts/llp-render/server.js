// 시안 보드(.dc.html)를 로컬에서 확인하기 위한 작은 정적 서버.
// 사용: node server.js <port>
const http = require('http')
const fs = require('fs')
const path = require('path')

const here = __dirname
const project = path.join(here, '..', 'llp-design', 'project')
const blobs = path.join(here, 'blob')
const port = Number(process.argv[2] || 5199)

function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf.slice(0, 4).toString() === 'wOF2') return 'font/woff2'
  return 'image/svg+xml'
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' }

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let file
  if (url.pathname.startsWith('/_blob/')) {
    file = path.join(blobs, path.basename(url.pathname))
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
    const buf = fs.readFileSync(file)
    res.writeHead(200, { 'content-type': sniff(buf), 'cache-control': 'no-store' })
    res.end(buf)
    return
  }
  if (url.pathname.startsWith('/project/')) file = path.join(project, path.basename(url.pathname))
  else if (url.pathname === '/') file = path.join(here, 'view.html')
  else file = path.join(here, path.basename(url.pathname))
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(fs.readFileSync(file))
}).listen(port, () => console.log('listening ' + port))
