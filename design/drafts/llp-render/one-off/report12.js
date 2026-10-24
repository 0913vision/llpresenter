// 결정(바로 출력, 곡 구성 프리셋), NDI SDK 확인, 군더더기 정리를 보고 페이지와 캔버스에 반영한다.
const fs = require('fs')
const dir = '../llp-design/project/'
const f = dir + 'Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 70)); s = s.replace(a, () => b) }
const cutEntry = (startKey) => {
  const a = s.indexOf(startKey)
  if (a < 0) throw new Error('entry ' + startKey)
  const next = s.indexOf("{ name: '", a + 5)
  const end = s.indexOf('\n]', a)
  const b = next > 0 && next < end ? next : end
  s = s.slice(0, a) + s.slice(b)
}

rep('시안 보고 8차', '시안 보고 9차')
const h1 = s.indexOf('2026년 10월 24일.')
const h2 = s.indexOf('</p>', h1)
s = s.slice(0, h1) + '2026년 10월 24일. 출력은 프로프리젠터처럼 누르면 바로 나가게 하고, 곡 구성은 곡에 저장하는 프리셋으로 정했습니다. 모든 보드의 설명 문구와 군더더기 상태 표시를 걷어냈고, NDI SDK 사용 조건을 확인했습니다. 앱 코드는 아직 멈춰 둔 상태입니다.' + s.slice(h2)

rep('예배 순서 항목은 그 원본을 가리키면서 이번 예배의 구성(장 순서와 반복), 배경, 시작할 때 실행할 매크로, 메모를 따로 가집니다. 가사를 고치면 원본이 바뀌어 그 곡을 쓰는 예배 순서에 모두 반영되고, 구성을 바꾸면 이번 예배에만 적용됩니다.',
  '예배 순서 항목은 그 원본을 가리키면서 곡에 저장된 구성 중 하나를 고르고, 이번 배경, 시작할 때 실행할 매크로, 메모를 따로 가집니다. 가사를 고치면 원본이 바뀌어 그 곡을 쓰는 예배 순서에 모두 반영됩니다.')
rep("{ title: '구성대로 진행',", `{ title: '곡 구성은 프리셋', desc: '곡마다 기본(파일 순서), 주일용, 짧게처럼 이름 붙인 구성을 저장하고, 예배 순서 항목에서 하나를 고릅니다. 구성은 특정 예배와 상관없이 곡에 속하며, 프로프리젠터의 Arrangement와 같은 방식입니다.' },
{ title: '출력은 누르면 바로', desc: '프로프리젠터처럼 장을 누르면 바로 출력합니다. 대기 후 출력 비교안은 백업으로 옮겼습니다.' },
{ title: 'NDI SDK', desc: '비영리로 한 교회 안에서만 쓰고 배포하지 않으므로 무료 NDI SDK를 쓸 수 있습니다. 배포하게 되면 SDK 배포 조건과 NDI 상표 표기를 다시 확인합니다.' },
{ title: '구성대로 진행',`)

rep("{ topic: '출력 방식', pp: '장을 누르면 바로 출력', ours: '같은 방식이 기본, 대기 후 출력은 비교안' }", "{ topic: '출력 방식', pp: '장을 누르면 바로 출력', ours: '같은 방식' }")
rep("ours: '곡 파일에는 가사만, 구성은 예배 순서 항목에 저장 (정할 것)' }", "ours: '같은 방식, 예배 순서 항목에서 고름' }")

rep('{ "label": "", "lines": ["...", "..."] }\\n  ]\\n}\'', '{ "label": "", "lines": ["...", "..."] }\\n  ],\\n  "arrangements": [\\n    { "name": "주일용", "slides": [1, 2, 3, 4, 2, 3, 4, 3, 4] },\\n    { "name": "짧게", "slides": [1, 2, 3, 4] }\\n  ]\\n}\'')
rep('<li>장의 순서는 파일에 적힌 순서 그대로이며, 곡 순서(편곡)는 저장하지 않습니다.</li>', '<li>기본 구성은 파일에 적힌 장 순서이고, 그 밖의 구성은 arrangements에 이름과 장 번호 목록으로 저장합니다. 구성은 특정 예배와 상관없이 곡에 속합니다.</li>')

rep('<li>처음 켤 때 출력 방식 기본값: 바로 출력 또는 대기 후 출력 (비교안: 대기 후 출력)</li>\n', '')
const g1 = s.indexOf('<li>곡 구성을 다시 쓰는 방식:')
s = s.slice(0, g1) + s.slice(s.indexOf('</li>\n', g1) + 6)
rep('<li>NDI SDK를 앱에 넣을 때의 라이선스 조건 확인</li>', '<li>배포하게 되면 NDI SDK 배포 조건과 상표 표기 다시 확인 (지금처럼 비영리로 한 교회에서만 쓰는 데는 문제없음)</li>')

cutEntry("{ name: '비교안: 대기 후 출력'")
cutEntry("{ name: '비교안: 구성 불러오기'")
rep('예배 순서에서 곡을 고르면 이번 예배의 구성을 편집합니다. 장 칩을 끌어 순서를 바꾸고 반복을 넣으며, 썸네일은 그 순서대로 보입니다.',
  '예배 순서에서 곡을 고르면 이 예배에서 쓸 구성과 설정을 정합니다. 곡에 저장된 구성(주일용 등) 중 하나를 고르고, 장 칩을 끌어 그 구성을 고치며, 썸네일은 그 순서대로 보입니다.')
rep('위쪽에 이 곡을 쓰는 예배 순서 수와 기본 배경이 보입니다.', '위쪽에 이 곡을 쓰는 예배 순서 수와 기본 배경이 보이고, 그 아래 구성 줄에서 곡에 저장된 구성을 관리합니다.')
if (/[·—]/.test(s)) throw new Error('middle dot or em dash found')
fs.writeFileSync(f, s)

const cf = dir + 'canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
Object.assign(c.boards['CueTake.dc.html'], { x: 1360, y: 5300, title: '대기 후 출력 비교안', page: 'backup' })
Object.assign(c.boards['PrepArrange.dc.html'], { x: 3360, y: 5300, title: '구성 불러오기 비교안', page: 'backup' })
Object.assign(c.boards['ClearGroups.dc.html'], { x: 1360, y: 7100 })
c.notes.rowCompare.maxW = 1204
c.notes.decidedTitle = { x: 1360, y: 5000, text: '결정 후 뺀 비교안', kind: 'title1', maxW: 3920, page: 'backup' }
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('ok')
