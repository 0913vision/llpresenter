// 시안 v2 보드 전체에서 색, 글자 크기, 높이, 모서리, 그림자 값이 얼마나 쓰였는지 센다.
const fs = require('fs')
const d = '../llp-design/project/'
const c = JSON.parse(fs.readFileSync(d + 'canvas.json', 'utf8'))
const boards = Object.entries(c.boards).filter(([f, b]) => b.page === 'v2' && f !== 'Main.dc.html').map(([f]) => f)
const count = {}
const add = (k, v, f) => { count[k] = count[k] || {}; const e = count[k][v] = count[k][v] || { n: 0, files: new Set() }; e.n++; e.files.add(f.replace('.dc.html', '')) }
for (const f of boards) {
  let s = fs.readFileSync(d + f, 'utf8')
  s = s.slice(s.indexOf('</style>'))
  for (const m of s.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g)) add('color', m[0].toLowerCase(), f)
  for (const m of s.matchAll(/font-size: ([0-9.]+px)/g)) add('font-size', m[1], f)
  for (const m of s.matchAll(/(?<![-a-z])height: ([0-9.]+px)/g)) add('height', m[1], f)
  for (const m of s.matchAll(/border-radius: ([^;"]+)/g)) add('radius', m[1], f)
  for (const m of s.matchAll(/box-shadow: ([^;"]+)/g)) add('shadow', m[1], f)
  for (const m of s.matchAll(/font-weight: ([0-9]+)/g)) add('weight', m[1], f)
  for (const m of s.matchAll(/line-height: ([^;"]+)/g)) add('line-height', m[1], f)
  for (const m of s.matchAll(/(?<![-a-z])gap: ([^;"]+)/g)) add('gap', m[1], f)
  for (const m of s.matchAll(/(?<![-a-z])padding: ([^;"]+)/g)) add('padding', m[1], f)
  for (const m of s.matchAll(/class="i (i[0-9]+) /g)) add('icon-size', m[1], f)
}
const out = []
for (const [k, vals] of Object.entries(count)) {
  out.push('## ' + k)
  for (const [v, e] of Object.entries(vals).sort((a, b) => b[1].n - a[1].n)) out.push(`${String(e.n).padStart(5)}  ${v}   [${[...e.files].slice(0, 6).join(', ')}${e.files.size > 6 ? ' +' + (e.files.size - 6) : ''}]`)
}
fs.writeFileSync('logs/audit.txt', out.join('\n'))
console.log(boards.length, 'boards')
