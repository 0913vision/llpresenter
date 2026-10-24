// 설정은 프로프리젠터처럼 앱 전체에 하나만 둔다는 결정을 머리글, 파일 메뉴, 보고 페이지, 캔버스에 반영한다.
// build-scene.js 보다 먼저 돌린다 (준비 화면 머리글을 바꾸므로).
const fs = require('fs')
const proj = '../llp-design/project/'
function edit(file, fn) {
  let s = fs.readFileSync(file, 'utf8')
  const rep = (a, b, count) => {
    const n = s.split(a).length - 1
    if (n !== (count || 1)) throw new Error(file + ': expected ' + (count || 1) + ', found ' + n + ': ' + a.slice(0, 90))
    s = s.split(a).join(b)
  }
  // 한 줄짜리 항목을 통째로 바꾼다 (끝의 쉼표는 그대로 둔다)
  const line = (startKey, next) => {
    const a = s.indexOf(startKey)
    if (a < 0 || s.indexOf(startKey, a + 1) >= 0) throw new Error(file + ': line key ' + startKey)
    const b = s.indexOf('\n', a)
    const comma = s.slice(a, b).trimEnd().endsWith(',') ? ',' : ''
    s = s.slice(0, a) + next + comma + s.slice(b)
  }
  const cut = (startKey, endKey, insert) => {
    const a = s.indexOf(startKey)
    const b = s.indexOf(endKey, a)
    if (a < 0 || b < 0) throw new Error(file + ': cut ' + startKey.slice(0, 40))
    s = s.slice(0, a) + (insert || '') + s.slice(b + endKey.length)
  }
  fn({ rep, line, cut, get: () => s, set: (v) => { s = v } })
  if (/[·—]/.test(s)) throw new Error(file + ': middle dot or em dash')
  fs.writeFileSync(file, s)
  console.log('edited', file)
}

// ---------- 예배 순서 머리글의 이름을 누르면 목록이 펼쳐진다 ----------
const nameSpan = '<span style="margin-left: 10px; font-size: 12px; color: #8c8c8c">주일 예배</span>'
const nameButton = '<button type="button" class="hv" aria-haspopup="menu" style="margin-left: 4px; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 4px 0 6px; border: 0; border-radius: 4px; background: transparent; color: #8c8c8c; font-size: 12px">주일 예배<span class="i i12 i-down"></span></button>'
const swept = []
for (const f of fs.readdirSync('src').filter((f) => f.endsWith('.html'))) {
  if (['ServiceOpen.html', 'ServiceImport.html', 'NewService.html', 'Import.html', 'ImportConflict.html', 'PrepArrange.html'].includes(f)) continue
  const s = fs.readFileSync('src/' + f, 'utf8')
  if (s.includes(nameSpan)) { edit('src/' + f, ({ rep }) => rep(nameSpan, nameButton)); swept.push(f) }
}
edit(proj + 'ShowH.dc.html', ({ rep }) => rep(nameSpan, nameButton))
fs.writeFileSync('logs/swept.txt', swept.join('\n') + '\n')

// ---------- 파일 메뉴: 열기와 최근 예배를 빼고 하위 메뉴 위치를 맞춘다 ----------
edit('src/ImportMenu.html', ({ get, set, rep }) => {
  const lines = get().split('\n')
  const i = lines.findIndex((l) => l.includes('<span style="flex: 1">열기</span>'))
  const j = lines.findIndex((l) => l.includes('<span style="flex: 1">최근 예배</span>'))
  if (i < 0 || j !== i + 1 || !lines[j + 1].startsWith('<div style="height: 1px')) throw new Error('menu lines')
  lines.splice(i, 3)
  set(lines.join('\n'))
  // 가져오기 항목(위에서 129px)과 하위 메뉴의 첫 항목 높이를 맞춘다
  rep('aria-label="가져오기" style="position: absolute; left: 300px; top: 214px;', 'aria-label="가져오기" style="position: absolute; left: 300px; top: 123px;')
})

// ---------- 보고 페이지 ----------
edit(proj + 'Main.dc.html', ({ rep, line, cut, get, set }) => {
  let s = get()
  const h1 = s.indexOf('2026년 10월 24일.')
  const h2 = s.indexOf('</p>', h1)
  set(s.slice(0, h1) + '2026년 10월 24일. 예배 파일에 모든 설정을 담는 안을 검토한 뒤, 프로프리젠터처럼 화면, Look, 매크로 같은 설정은 앱 전체에 하나만 두고 예배 순서에는 항목만 담기로 했습니다. 다른 예배에서는 예배 순서 항목만 골라 가져오고, 카메라 입력은 나중에 더할 수 있게 구조를 열어 둡니다. 저장은 자동이고, 비정상 종료 뒤에는 출력 상태만 복구합니다. 앱 코드는 아직 멈춰 둔 상태입니다.' + s.slice(h2))

  line("{ title: '예배 파일에 모든 설정',", "{ title: '설정은 앱 전체에 하나', desc: '프로프리젠터처럼 화면, Look, 무대 배치, 매크로, 퀵 실행, 메시지, 공지, 소품, 타이머는 앱 전체에 하나만 두고, 예배 순서에는 항목만 담습니다. 한 번 고치면 모든 예배에 적용됩니다. 예배마다 모습을 달리하려면 Look을 여러 개 두고 항목의 시작 매크로로 바꿉니다.' }")
  line("{ title: '다른 예배에서 골라 가져오기',", "{ title: '다른 예배에서 골라 가져오기', desc: '다른 예배나 틀에서 예배 순서 항목을 골라 지금 예배 순서 끝에 더합니다. 프로프리젠터 공식 문서에서는 확인하지 못한 기능이라 우리 쪽 추가입니다.' }")
  line("{ title: '새 예배도 같은 창',", `{ title: '새 예배', desc: '빈 예배, 틀, 지난 예배 중에서 고르고 가져올 항목을 정해 만듭니다. 틀은 프로프리젠터의 Playlist Template을 따랐고, 지난 예배에서 시작하는 것은 우리 쪽 추가입니다.' },
{ title: '예배 순서 바꾸기', desc: '프로프리젠터는 왼쪽 위의 재생목록 목록에서 고릅니다. 우리는 같은 목록을 예배 순서 머리글의 이름을 누르면 펼치고, 그 아래에서 새 예배와 다른 예배에서 가져오기도 엽니다.' },
{ title: '카메라 입력은 나중에', desc: '프로프리젠터는 설정의 입력에서 USB 캡처 장치, SDI, NDI 입력을 등록하고, 미디어의 비디오 입력 목록, 장과 매크로의 동작, 장 편집기의 요소로 씁니다. 나중에 카메라를 이 방식으로 더할 수 있게, 입력 목록을 화면처럼 앱 전체 설정으로 두고 미디어 종류, 동작 종류, 장 요소를 넓힐 수 있는 구조로 만듭니다.' }`)

  rep('예배 파일 (.llservice)</h2>', '예배 순서 파일 (.llservice)</h2>')
  line("serviceSample: '", "serviceSample: '{\\n  \"format\": \"llservice\",\\n  \"schemaVersion\": 1,\\n  \"name\": \"주일 예배\",\\n  \"date\": \"2026-11-01T11:00\",\\n  \"order\": [\\n    { \"header\": \"찬양\" },\\n    { \"song\": \"6f1c2a9e-...\", \"arrangement\": \"주일용\", \"background\": \"3b9d0c52-...\", \"macro\": \"찬양\", \"memo\": \"\" },\\n    { \"slot\": \"song\", \"title\": \"찬양\" },\\n    ...\\n  ]\\n}'")
  cut('<li>예배 하나가 파일 하나입니다.', '<li>출력 상태(켜져 있던 화면, 마지막 장, 표시 중이던 항목)는 파일에 넣지 않습니다.</li>',
    `<li>예배 순서 하나가 파일 하나이며 항목만 담습니다. 화면, Look, 매크로 같은 설정은 앱 전체에 하나만 둡니다.</li>
<li>곡과 미디어는 복사하지 않고 라이브러리의 고유 번호로 가리킵니다. 곡 구성은 이름으로 고릅니다.</li>
<li>틀도 같은 형식이며, 빈 자리 항목을 가질 수 있습니다.</li>
<li>출력 상태(켜져 있던 화면, 마지막 장, 표시 중이던 항목)는 파일에 넣지 않습니다.</li>`)

  line("{ topic: '예배와 설정',", "{ topic: '예배와 설정', pp: '재생목록에는 항목만, 화면, Look, 매크로, 무대 배치는 앱 전체 설정', ours: '같은 방식' }")
  line("{ topic: '새 예배',", `{ topic: '새 예배', pp: 'Playlist Template에서 만듦', ours: '같은 방식, 지난 예배에서도 시작' },
{ topic: '예배 순서 고르기', pp: '왼쪽 위 재생목록 목록', ours: '예배 순서 머리글의 이름을 누르면 펼치는 목록' },
{ topic: '카메라 입력', pp: '설정의 입력에서 캡처 장치, SDI, NDI 입력을 등록', ours: '나중에 같은 방식으로 더함' }`)

  line("{ name: '새 예배 만들기',", "{ name: '새 예배 만들기', play: false, desc: '빈 예배, 틀, 지난 예배 중에서 고르면 오른쪽에 그 예배 순서가 보이고, 가져올 항목을 체크해 만듭니다. 틀에서 시작하면 모두 체크된 상태입니다.' }")
  line("{ name: '예배 열기',", "{ name: '예배 순서 바꾸기', play: false, desc: '예배 순서 머리글의 이름을 누르면 예배 순서 목록이 펼쳐집니다. 검색으로 찾고, 아래에서 새 예배, 다른 예배에서 가져오기, 지금 예배를 틀로 저장을 엽니다.' }")
  line("{ name: '다른 예배에서 가져오기',", "{ name: '다른 예배에서 가져오기', play: false, desc: '다른 예배나 틀에서 고른 항목을 지금 예배 순서 끝에 더합니다. 머리글을 체크하면 그 아래 항목이 함께 체크됩니다.' }")
  line("{ name: '파일 메뉴',", "{ name: '파일 메뉴', play: false, desc: '저장은 자동이므로 저장 항목이 없습니다. 새 예배, 다른 예배에서 가져오기, 지금 예배를 틀로 저장을 두고, 가져오기 아래에 텍스트 파일, 클립보드 텍스트, PowerPoint 파일을 따로 둡니다.' }")

  rep('\n<li>출력 중에 다른 예배를 열 때: 화면 설정도 함께 바뀌므로 확인을 물을지</li>', '')
  rep('\n<li>예배 파일의 이름: 지금은 예배. 신은 교회 앱에서 다른 뜻으로 읽힐 수 있고, OBS 한국어판의 장면은 우리 앱의 장(슬라이드)과 헷갈림</li>', '')
})

// ---------- 캔버스 ----------
const cf = proj + 'canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
c.notes.rowService.text = '예배 순서 만들기와 가져오기'
c.boards['ServiceSwitch.dc.html'] = { x: 3360, y: 7100, w: 1920, h: 1080, title: '예배 순서 바꾸기', page: 'v2' }
Object.assign(c.boards['ServiceOpen.dc.html'], { x: 5360, y: 5300, title: '예배 열기 (예배 파일안)', page: 'backup' })
c.boards['ServiceImportScene.dc.html'] = { x: 7360, y: 5300, w: 1920, h: 1080, title: '다른 예배에서 가져오기 (예배 파일안)', page: 'backup' }
c.notes.decidedTitle.maxW = 7920
c.order.splice(c.order.indexOf('ServiceOpen.dc.html'), 1, 'ServiceSwitch.dc.html')
c.order.splice(c.order.indexOf('PrepArrange.dc.html') + 1, 0, 'ServiceOpen.dc.html', 'ServiceImportScene.dc.html')
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('canvas ok')
