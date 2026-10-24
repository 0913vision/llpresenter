// 다중 레이어 지우기를 v1에서 빼고 매크로로 대신하기로 한 결정을 보고 페이지와 캔버스에 반영한다.
const fs = require('fs')
const dir = '../llp-design/project/'
const f = dir + 'Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 70)); s = s.replace(a, () => b) }
const cutLine = (key) => { const a = s.indexOf(key); if (a < 0 || s.indexOf(key, a + 1) >= 0) throw new Error('line ' + key); s = s.slice(0, a) + s.slice(s.indexOf('\n', a) + 1) }
cutLine('<li>다중 레이어 지우기를 둘지')
rep("ours: '레이어별 일곱 개, 다중 레이어 지우기는 비교안' }", "ours: '레이어별 일곱 개, 여러 층을 한 번에 지울 때는 매크로' }")
cutLine("{ name: '비교안: 다중 레이어 지우기'")
rep("{ title: '진행 화면은 절충안',", "{ title: '다중 레이어 지우기는 v1에서 뺌', desc: '여러 층을 한 번에 지우는 일은 매크로의 지우기 동작으로 합니다. 예배 순서 항목의 시작할 때 매크로에 걸어 두면 그 항목을 시작할 때 저절로 지워집니다. 비교안 보드는 백업으로 옮겼습니다.' },\n{ title: '진행 화면은 절충안',")
if (/[·—]/.test(s)) throw new Error('middle dot or em dash found')
// 보드 안내 목록의 마지막 항목 뒤에 쉼표가 남지 않게 한다
s = s.replace(/,\n(\]\s*;?\s*\n)/g, '\n$1')
fs.writeFileSync(f, s)

const cf = dir + 'canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
Object.assign(c.boards['ClearGroups.dc.html'], { x: 9360, y: 5300, title: '다중 레이어 지우기 비교안', page: 'backup' })
c.notes.decidedTitle.maxW = 9360 + 1204 - 1360
delete c.notes.rowCompare
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('ok')
