// 디자인 시스템 미리보기를 로컬에서 그려 보는 서버. 사용: node card-server.js [포트]
// /card/<Comp> 는 preview.html 머리에 tokens.css와 bundle.css를 넣어 준다(실제 페이지의 미리보기 틀과 같은 순서).
const http = require('http')
const fs = require('fs')
const path = require('path')
const root = __dirname
const port = Number(process.argv[2] || 5299)
const blobs = {}
for (const [file, dir, ext] of [['icon-ids.tsv', 'upload/Icons', '.svg'], ['media-ids.tsv', 'upload/Media', '.jpg']]) {
  for (const l of fs.readFileSync(path.join(root, file), 'utf8').trim().split('\n')) { const [k, id] = l.split('\t'); blobs[id] = path.join(root, dir, k + ext) }
}
const types = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.js': 'text/javascript' }
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const send = (file, type) => fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); res.end('not found ' + url); return } res.writeHead(200, { 'content-type': type || types[path.extname(file)] || 'application/octet-stream' }); res.end(buf) })
  if (url.startsWith('/_blob/')) return blobs[url.slice(7)] ? send(blobs[url.slice(7)]) : (res.writeHead(404), res.end('unknown blob'))
  if (url.startsWith('/card/')) {
    const comp = url.slice(6).replace(/[^A-Za-z0-9_]/g, '')
    const file = path.join(root, 'project/components', comp, 'preview.html')
    return fs.readFile(file, 'utf8', (e, html) => {
      if (e) { res.writeHead(404); res.end('no preview for ' + comp); return }
      const head = '<link rel="stylesheet" href="/project/tokens.css"><link rel="stylesheet" href="/project/components/bundle.css"><style>html,body{margin:0;background:#0e0e0e}</style>'
      let out = html.replace(/<html([^>]*)>/i, '<html$1 data-theme="dark">')
      out = /<head[^>]*>/i.test(out) ? out.replace(/<head([^>]*)>/i, '<head$1>' + head) : head + out
      // 미리보기 안의 상대 경로(../../)는 project/ 기준
      out = out.replace(/(["'(])\.\.\/\.\.\//g, '$1/project/')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(out)
    })
  }
  if (url.startsWith('/project/')) return send(path.join(root, url))
  res.writeHead(404); res.end('?')
}).listen(port, () => console.log('card server on', port))
