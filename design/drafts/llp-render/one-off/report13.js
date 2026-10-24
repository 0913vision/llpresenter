// 디자인 시스템 확정을 보고 페이지에 반영한다.
const fs = require('fs')
const f = '../llp-design/project/Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 70)); s = s.replace(a, () => b) }
rep('시안 보고 10차', '시안 보고 11차')
const h1 = s.indexOf('2026년 10월 24일.')
const h2 = s.indexOf('</p>', h1)
s = s.slice(0, h1) + '2026년 10월 24일. 버튼부터 창 크기까지 모든 요소의 크기, 색, 상태, 글쓰기 규칙을 디자인 시스템으로 확정해 문서화했고, 시안 보드를 그 값에 맞췄습니다. 구현은 디자인 시스템을 기준으로 합니다. 앱 코드는 아직 멈춰 둔 상태입니다.</p>\n<p style="margin: 0; color: #a3a3a3">디자인 시스템: <a href="https://claude.ai/artifact/LDSJg1gwuFymJBuTbVEBQP" style="color: #3d8bf0">LoveLight 디자인 시스템</a>' + s.slice(h2)
rep("{ title: '진행 화면은 절충안',", `{ title: '디자인 시스템', desc: '원칙, 토큰, 창 크기 규칙, 컴포넌트 30개(버튼, 입력, 목록, 메뉴, 대화상자, 썸네일, 미리보기 등)를 문서와 미리보기로 확정했습니다. 시안 보드와 디자인 시스템이 다르면 디자인 시스템이 기준입니다.' },
{ title: '파랑은 둘', desc: '선과 포커스와 고른 테두리는 #3d8bf0, 주 버튼과 켜진 체크 상자 같은 면은 흰 글자가 읽히도록 더 어두운 #2a70dc를 씁니다.' },
{ title: '버튼 높이는 둘', desc: '패널 안은 26, 대화상자와 환경설정과 툴바 검색 칸은 30입니다. 24, 28, 32 버튼은 없앴습니다.' },
{ title: '창 크기 세 구간', desc: 'Windows 배율을 적용한 너비로 좁은 창 1280부터(열 220/360, 툴바 40), 보통 창 1600부터(280/480), 넓은 창 2400부터(320/560)입니다. 최소 창은 1280×720이고, 열 사이를 끌어 너비를 바꿀 수 있습니다.' },
{ title: '화면 출력 버튼', desc: '켜짐은 빨간 점, 꺼짐은 점 없이 흐린 아이콘과 이름, 모니터를 찾을 수 없으면 주황 점입니다. 툴팁은 "본 화면 출력 끄기 (모니터 2)"처럼 씁니다.' },
{ title: '빨강은 출력에만', desc: '빨강은 지금 화면에 나가는 것에만 씁니다. 메뉴의 삭제 항목도 따로 칠하지 않고, 되돌릴 수 없으면 확인 창으로 묻습니다.' },
{ title: '진행 화면은 절충안',`)
rep('<li>화면 출력 버튼 표현: 툴팁과 꺼진 상태를 더 분명하게</li>\n', '')
if (/[·—]/.test(s)) throw new Error('middle dot or em dash found')
fs.writeFileSync(f, s)
console.log('ok')
