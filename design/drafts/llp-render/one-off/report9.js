// 가져오기와 대기 후 출력 수정을 보고 페이지와 캔버스에 반영한다.
const fs = require('fs')
const dir = '../llp-design/project/'
fs.copyFileSync(dir + 'Import.dc.html', dir + 'ImportV1.dc.html')

const f = dir + 'Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 60)); s = s.replace(a, () => b) }
rep('가사 가져오기의 군더더기를 덜었으며,', '가사 가져오기를 프로프리젠터처럼 형식별, 파일별로 다시 그렸으며,')
const oldImport = s.slice(s.indexOf("{ name: '가사 가져오기'"), s.indexOf("{ name: '미디어 가져오기와 재생목록'"))
if (!oldImport) throw new Error('import entry')
s = s.replace(oldImport, "{ name: '텍스트 가져오기', play: false, desc: '파일 메뉴의 가져오기에서 텍스트 파일, 클립보드 텍스트, PowerPoint 파일을 따로 고릅니다. 텍스트는 파일 하나씩 장 나누기 기준(빈 줄, 줄 바꿈, 기호)과 한 장에 넣을 개수를 정해 결과를 미리 보고, 편집을 누르면 가져오기 전에 준비 화면의 편집기로 고칩니다. 프로프리젠터의 가져오기 창을 따랐습니다.' },\n")
rep('장을 한 번 누르면 대기에 올라가고, 툴바의 출력 버튼을 눌러야 화면에 나갑니다. 프로프리젠터에는 없는 방식이라 툴바에 Go Live 버튼을 두는 이지워십 방식을 따랐고,',
  '장을 한 번 누르면 대기에 올라가고, 대기 화면 제목줄의 출력 버튼이나 Page Down을 눌러야 화면에 나갑니다. 프로프리젠터에는 없는 방식이라 대기 화면 바로 곁에 전환 버튼을 두는 OBS 스튜디오 모드를 참고했고,')
if (/[·—]/.test(s)) throw new Error('middle dot or em dash found')
fs.writeFileSync(f, s)

const cf = dir + 'canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
const imp = c.boards['Import.dc.html']
delete c.boards['Import.dc.html']
c.boards['ImportText.dc.html'] = { x: imp.x, y: imp.y, w: 1920, h: 1080, title: '텍스트 가져오기', page: 'v2' }
c.boards['ImportMenu.dc.html'] = { x: 13360, y: 4300, w: 760, h: 420, title: '가져오기 메뉴', page: 'v2' }
c.boards['ImportV1.dc.html'] = { x: 11000, y: 3900, w: 1920, h: 1080, title: '가사 가져오기 1차', page: 'backup' }
c.order = c.order.map((n) => (n === 'Import.dc.html' ? 'ImportText.dc.html' : n))
c.order.splice(c.order.indexOf('ImportText.dc.html') + 1, 0, 'ImportMenu.dc.html')
c.order.splice(c.order.indexOf('MacrosV1.dc.html') + 1, 0, 'ImportV1.dc.html')
c.notes.rowExtra2.maxW = 12760
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('ok', Object.keys(c.boards).length, 'boards')
