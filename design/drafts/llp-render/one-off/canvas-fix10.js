const fs = require('fs')
const cf = '../llp-design/project/canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
c.boards['ClearGroups.dc.html'].title = '비교안: 다중 레이어 지우기'
c.boards['ImportConflict.dc.html'] = { x: 11360, y: 4300, w: 1920, h: 1080, title: '같은 곡이 있을 때', page: 'v2' }
c.boards['ImportMenu.dc.html'].x = 13360
c.boards['Media.dc.html'].x = 14200
c.notes.rowExtra2.maxW = 14760
if (!c.order.includes('ImportConflict.dc.html')) c.order.splice(c.order.indexOf('ImportText.dc.html') + 1, 0, 'ImportConflict.dc.html')
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
const f = '../llp-design/project/Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const anchor = "{ name: '미디어 가져오기와 재생목록'"
if (s.split(anchor).length !== 2) throw new Error('anchor')
s = s.replace(anchor, "{ name: '같은 곡이 있을 때', play: false, desc: '가져오기를 누른 뒤 라이브러리에 같은 제목의 곡이 있을 때만 작은 확인 창이 뜹니다. macOS Finder처럼 둘 다 유지, 바꾸기, 건너뛰기 중에서 고르고, 평소의 가져오기 창에는 따로 표시하지 않습니다.' },\n" + anchor)
if (/[·—]/.test(s) || s.includes('맞춤 지우기')) throw new Error('check text')
fs.writeFileSync(f, s)
console.log('ok', Object.keys(c.boards).length)
