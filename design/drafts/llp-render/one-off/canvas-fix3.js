// 추가 시안 보드를 캔버스의 시안 페이지에 줄별로 배치한다.
const fs = require('fs')
const f = '../llp-design/project/canvas.json'
const c = JSON.parse(fs.readFileSync(f, 'utf8'))
const add = (file, x, y, w, h, title, interactive) => {
  c.boards[file] = Object.assign({ x, y, w, h, title, page: 'v2' }, interactive ? { is_interactive: true } : {})
  if (!c.order.includes(file)) c.order.splice(c.order.indexOf('ShowE.dc.html'), 0, file)
}
add('Problems.dc.html', 1360, 2900, 1920, 1080, '문제 상황: 진행 중')
add('Recovery.dc.html', 3360, 2900, 1920, 1080, '문제 상황: 다시 시작')
add('Compact.dc.html', 5360, 2900, 1366, 768, '진행 화면 1366×768')
add('Bible.dc.html', 1360, 4300, 1920, 1080, '성경 구절 띄우기')
add('NewService.dc.html', 3360, 4300, 1920, 1080, '새 예배 만들기')
add('AddSongs.dc.html', 5360, 4300, 1920, 1080, '예배 순서에 곡 넣기')
add('Import.dc.html', 7360, 4300, 1920, 1080, '가사 가져오기')
add('Media.dc.html', 9360, 4300, 1920, 1080, '미디어 가져오기와 재생목록')
add('StageEditor.dc.html', 1360, 5700, 1920, 1080, '무대 화면 배치 편집')
add('Prefs.dc.html', 3360, 5700, 1040, 800, '환경설정', true)
add('Shortcuts.dc.html', 4480, 5700, 1040, 800, '단축키 설정')
add('CueTake.dc.html', 1360, 7100, 1920, 1080, '비교안: 대기 후 출력', true)
add('PrepArrange.dc.html', 3360, 7100, 1920, 1080, '비교안: 구성 불러오기')
add('ScreensNDI.dc.html', 5360, 7100, 1920, 1080, '비교안: NDI 출력')
add('ClearGroups.dc.html', 7360, 7100, 1204, 552, '비교안: 지우기 묶음')
c.notes.rowExtra1 = { x: 1360, y: 2600, text: '문제 상황과 작은 화면', kind: 'title1', maxW: 5366, page: 'v2' }
c.notes.rowExtra2 = { x: 1360, y: 4000, text: '준비 기능', kind: 'title1', maxW: 9920, page: 'v2' }
c.notes.rowExtra3 = { x: 1360, y: 5400, text: '무대 배치와 환경설정', kind: 'title1', maxW: 4160, page: 'v2' }
c.notes.rowCompare = { x: 1360, y: 6800, text: '비교안 (정할 것)', kind: 'title1', maxW: 7204, page: 'v2' }
fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n')
console.log(Object.keys(c.boards).length, 'boards')
