// 가져오기 흐름(불러오기, 편집, 저장)과 대기 표시 정리를 보고 페이지와 캔버스에 반영한다.
const fs = require('fs')
const dir = '../llp-design/project/'
const f = dir + 'Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const cut = (startKey, endKey, insert) => {
  const a = s.indexOf(startKey), b = s.indexOf(endKey, a)
  if (a < 0 || b < 0) throw new Error('marker ' + startKey)
  s = s.slice(0, a) + insert + s.slice(b)
}
cut("{ name: '텍스트 가져오기'", "{ name: '미디어 가져오기와 재생목록'",
  "{ name: '가져오기 메뉴', play: false, desc: '파일 메뉴의 가져오기 아래에 텍스트 파일, 클립보드 텍스트, PowerPoint 파일을 따로 둡니다.' },\n" +
  "{ name: '텍스트 가져오기', play: false, desc: '텍스트 파일을 하나 고르면 불러온 결과가 이 창에 뜹니다. 장 나누기 기준(빈 줄, 줄 바꿈, 기호)과 한 장에 넣을 개수를 정해 장을 미리 보고, 버리기와 편집 중에서 고릅니다. 라이브러리에 같은 제목이 있으면 제목 칸이 빨간 테두리로 바뀝니다. 장 나누기 방식은 프로프리젠터의 가져오기 창을 따랐습니다.' },\n" +
  "{ name: '가져온 곡 편집', play: false, desc: '편집을 누르면 준비 화면의 편집기에서 아직 저장하지 않은 곡을 고칩니다. 제목이 겹치면 제목 칸의 빨간 테두리가 그대로 남고, 위쪽의 버리기와 저장으로 끝냅니다.' },\n" +
  "{ name: '저장할 때 같은 곡이 있으면', play: false, desc: '저장을 눌렀을 때 같은 제목의 곡이 라이브러리에 있으면 덮어쓸지 묻습니다. 덮어쓰기, 새 곡으로 저장, 취소 중에서 고릅니다.' },\n")
const oldCue = s.slice(s.indexOf("{ name: '비교안: 대기 후 출력'"), s.indexOf("{ name: '비교안: 구성 불러오기'"))
s = s.replace(oldCue, "{ name: '비교안: 대기 후 출력', play: true, desc: '장을 한 번 누르면 대기에 올라가고, 대기 화면 제목줄의 출력 버튼이나 Page Down을 눌러야 화면에 나갑니다. 프로프리젠터에는 없는 방식이라 OBS 스튜디오 모드를 참고했습니다. 대기와 출력 중은 프로프리젠터처럼 테두리 색(파랑, 빨강)으로만 구분하고, 다른 화면의 작은 미리보기가 빠지는 대신 두 화면을 위아래로 봅니다.' },\n")
if (/[·—]/.test(s)) throw new Error('middle dot or em dash found')
fs.writeFileSync(f, s)

const cf = dir + 'canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
const conflict = c.boards['ImportConflict.dc.html']
Object.assign(conflict, { x: 13000, y: 3900, title: '같은 곡이 있을 때 1차', page: 'backup' })
c.boards['ImportMenu.dc.html'].x = 9360
c.boards['ImportText.dc.html'].x = 10200
c.boards['ImportEdit.dc.html'] = { x: 12200, y: 4300, w: 1920, h: 1080, title: '가져온 곡 편집', page: 'v2' }
c.boards['ImportSave.dc.html'] = { x: 14200, y: 4300, w: 1920, h: 1080, title: '저장할 때 같은 곡이 있으면', page: 'v2' }
c.boards['Media.dc.html'].x = 16200
c.notes.rowExtra2.maxW = 16760
c.order = c.order.filter((n) => !['ImportMenu.dc.html', 'ImportText.dc.html', 'ImportConflict.dc.html', 'ImportEdit.dc.html', 'ImportSave.dc.html'].includes(n))
const at = c.order.indexOf('Media.dc.html')
c.order.splice(at, 0, 'ImportMenu.dc.html', 'ImportText.dc.html', 'ImportEdit.dc.html', 'ImportSave.dc.html')
c.order.splice(c.order.indexOf('ImportV1.dc.html') + 1, 0, 'ImportConflict.dc.html')
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('ok', Object.keys(c.boards).length)
