// 보드의 button 요소를 스타일(위치, 바깥 여백 제외)로 묶어 변형 목록을 만든다.
const fs = require('fs')
const d = '../llp-design/project/'
const c = JSON.parse(fs.readFileSync(d + 'canvas.json', 'utf8'))
const boards = Object.entries(c.boards).filter(([f, b]) => b.page === 'v2' && f !== 'Main.dc.html').map(([f]) => f)
const groups = {}
for (const f of boards) {
  const s = fs.readFileSync(d + f, 'utf8')
  for (const m of s.matchAll(/<button([^>]*)>/g)) {
    const st = (m[1].match(/style="([^"]*)"/) || [])[1] || ''
    const props = {}
    for (const part of st.split(';')) {
      const i = part.indexOf(':'); if (i < 0) continue
      const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim()
      if (['height', 'background', 'color', 'border-radius', 'font-size', 'font-weight', 'padding', 'width', 'box-shadow'].includes(k)) props[k] = v
    }
    const key = ['height', 'width', 'padding', 'background', 'color', 'border-radius', 'font-size', 'font-weight', 'box-shadow'].map((k) => props[k] ? k.replace('border-radius', 'r').replace('font-size', 'fs').replace('font-weight', 'fw').replace('background', 'bg') + '=' + props[k] : '').filter(Boolean).join('; ')
    const cls = (m[1].match(/class="([^"]*)"/) || [])[1] || ''
    const g = groups[key] = groups[key] || { n: 0, files: new Set(), cls: new Set() }
    g.n++; g.files.add(f.replace('.dc.html', '')); g.cls.add(cls)
  }
}
const out = Object.entries(groups).sort((a, b) => b[1].n - a[1].n).map(([k, g]) => `${String(g.n).padStart(4)}  ${k}  {${[...g.cls].join('|')}}  [${[...g.files].slice(0, 5).join(', ')}${g.files.size > 5 ? ' +' + (g.files.size - 5) : ''}]`)
fs.writeFileSync('logs/audit-buttons.txt', out.join('\n'))
console.log(out.length, 'variants')
