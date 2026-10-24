// 예배 파일 결정을 복구 창, 파일 메뉴, 보고 페이지, 캔버스에 반영한다.
const fs = require('fs')
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
  fn(rep, line, () => s, (v) => { s = v })
  if (/[·—]/.test(s)) throw new Error(file + ': middle dot or em dash')
  fs.writeFileSync(file, s)
  console.log('edited', file)
}

// ---------- 복구 창: 출력 상태만 ----------
edit('src/Recovery.html', (rep) => {
  rep('이전 작업 복구', '출력 상태 복구', 2)
  rep('\n<span style="margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums"><span>마지막 자동 저장</span><span style="color: #ececec">오전 11:24:52</span></span>', '')
  rep("r('order', '예배 순서', '주일 예배  12개 항목'),\n", '')
  rep(`const d = (kind, name, change, ok, state) => ({
isSong: kind === 'song', isNotice: kind === 'notice', isFile: kind === 'file', name: name, change: change,
ok: ok, bad: !ok, state: state, chipBg: ok ? '#16301f' : '#33280f', chipFg: ok ? '#3dbb6b' : '#e3a23b'
});
const sw = (label, on) => ({ label: label, checked: on ? 'true' : 'false', track: on ? '#3d8bf0' : '#3a3a3a', knob: on ? '14px' : '2px' });
`, '')
  rep(`],
drafts: [
d('song', '내 주를 가까이 하게 함은', '가사 2줄 수정', true, '복구됨'),
d('notice', '주일 광고', '장 순서 변경', true, '복구됨'),
d('file', '새가족 환영회.png', '가져오기 중단', false, '다시 가져오기')
],
options: [sw('화면 출력 바로 켜기', true), sw('마지막 장 바로 띄우기', false)]
};`, `]
};`)
})

// ---------- 파일 메뉴: 저장 대신 다른 예배에서 가져오기와 틀로 저장 ----------
edit('src/ImportMenu.html', (rep) => {
  rep('<span style="flex: 1">저장</span>', '<span style="flex: 1">다른 예배에서 가져오기</span>')
  rep('<span style="flex: 1">다른 이름으로 저장</span>', '<span style="flex: 1">지금 예배를 틀로 저장</span>')
})

// ---------- 보고 페이지 ----------
edit('../llp-design/project/Main.dc.html', (rep, line, get, set) => {
  rep('시안 보고 9차', '시안 보고 10차')
  let s = get()
  const h1 = s.indexOf('2026년 10월 24일.')
  const h2 = s.indexOf('</p>', h1)
  set(s.slice(0, h1) + '2026년 10월 24일. 예배 하나를 파일 하나로 두고 그 안에 예배 순서와 화면, Look, 매크로 같은 설정을 모두 담기로 했습니다. 예배를 열면 그 설정 그대로 돌아오고, 다른 예배에서는 필요한 항목과 설정만 골라 가져옵니다. 저장은 프로프리젠터처럼 자동이고, 비정상 종료 뒤에는 출력 상태만 복구합니다. 앱 코드는 아직 멈춰 둔 상태입니다.' + s.slice(h2))

  // 곡 파일 설명 뒤에 예배 파일 설명
  const pre = get().match(/<pre style="[^"]*">/)[0]
  rep('<li>모르는 항목은 지우지 않고 그대로 보존하므로, 나중에 악보 같은 항목을 더해도 기존 파일과 충돌하지 않습니다.</li>\n</ul>\n</section>\n',
    `<li>모르는 항목은 지우지 않고 그대로 보존하므로, 나중에 악보 같은 항목을 더해도 기존 파일과 충돌하지 않습니다.</li>
</ul>
</section>

<section style="display: flex; flex-direction: column; gap: 16px">
<h2 style="margin: 0; font-size: 21px; line-height: 30px; font-weight: 600; color: #f2f2f2">예배 파일 (.llservice)</h2>
${pre}{{ serviceSample }}</pre>
<ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px">
<li>예배 하나가 파일 하나입니다. 예배 순서와 함께 화면, Look, 무대 배치, 매크로, 퀵 실행, 메시지, 공지, 소품, 타이머를 모두 담으므로, 예배를 열면 그 설정 그대로 돌아옵니다.</li>
<li>곡과 미디어는 복사하지 않고 라이브러리의 고유 번호로 가리킵니다. 곡 구성은 이름으로 고릅니다.</li>
<li>환경설정, 단축키, 이름표 목록, 성경 역본은 예배와 상관없이 앱에 하나만 둡니다.</li>
<li>틀도 같은 형식의 예배 파일이며, 빈 자리 항목을 가질 수 있습니다.</li>
<li>출력 상태(켜져 있던 화면, 마지막 장, 표시 중이던 항목)는 파일에 넣지 않습니다.</li>
</ul>
</section>
`)
  rep("sample: '{", "serviceSample: '{\\n  \"format\": \"llservice\",\\n  \"schemaVersion\": 1,\\n  \"name\": \"주일 예배\",\\n  \"date\": \"2026-11-01T11:00\",\\n  \"order\": [\\n    { \"header\": \"찬양\" },\\n    { \"song\": \"6f1c2a9e-...\", \"arrangement\": \"주일용\", \"background\": \"3b9d0c52-...\", \"macro\": \"찬양\", \"memo\": \"\" },\\n    { \"slot\": \"song\", \"title\": \"찬양\" },\\n    ...\\n  ],\\n  \"screens\": [...],\\n  \"looks\": [...],\\n  \"stageLayouts\": [...],\\n  \"macros\": [...],\\n  \"quick\": [...],\\n  \"messages\": [...],\\n  \"notices\": [...],\\n  \"props\": [...],\\n  \"timers\": [...]\\n}',\nsample: '{")

  // 정한 것
  rep("{ title: '곡 구성은 프리셋',", `{ title: '예배 파일에 모든 설정', desc: '예배 하나를 파일 하나로 저장하고, 그 안에 예배 순서와 화면, Look, 무대 배치, 매크로, 퀵 실행, 메시지, 공지, 소품, 타이머를 모두 담습니다. 예배를 열면 그 설정 그대로 돌아옵니다. 프로프리젠터는 이런 설정을 앱 전체에 하나만 두므로 이 부분은 우리 쪽 설계이고, vMix의 Preset처럼 제작 설정 전체를 파일 하나에 담는 방식을 참고했습니다.' },
{ title: '다른 예배에서 골라 가져오기', desc: '다른 예배나 틀에서 예배 순서 항목과 설정을 골라 지금 예배에 더합니다. 고르지 않은 것은 지금 그대로 둡니다. Bitfocus Companion의 가져오기처럼 항목별로 고르고, 매크로나 Look처럼 안에 여러 개가 있는 설정은 펼쳐서 하나씩 고릅니다.' },
{ title: '새 예배도 같은 창', desc: '빈 예배, 틀, 지난 예배 중에서 고르고 가져올 항목과 설정을 정해 만듭니다. 틀은 프로프리젠터의 Playlist Template을 따랐습니다.' },
{ title: '저장은 자동', desc: '프로프리젠터처럼 곡, 예배, 설정은 바꿀 때마다 저장하고 저장 버튼은 두지 않습니다. 가져온 곡만 편집을 마치고 저장을 눌러야 라이브러리에 들어갑니다.' },
{ title: '복구는 출력 상태만', desc: '파일은 이미 저장되어 있으므로 다시 켜면 마지막 예배가 그대로 열립니다. 비정상 종료로 잃는 것은 켜져 있던 화면, 마지막 장, 표시 중이던 항목뿐이라 복구 창은 이것만 묻습니다.' },
{ title: '곡 구성은 프리셋',`)

  // 프로프리젠터와 다른 점
  line("{ topic: '비정상 종료',", "{ topic: '비정상 종료', pp: '바꿀 때마다 자동 저장', ours: '같은 방식, 다시 켤 때 출력 상태만 복구' }")
  rep("{ topic: '출력 방식',", "{ topic: '예배와 설정', pp: '재생목록에는 항목만, 화면, Look, 매크로, 무대 배치는 앱 전체 설정', ours: '예배 파일 하나에 순서와 설정을 모두 담고, 다른 예배에서 골라 가져옴' },\n{ topic: '새 예배', pp: 'Playlist Template에서 만듦', ours: '틀이나 지난 예배에서 가져올 것을 골라 만듦' },\n{ topic: '출력 방식',")

  // 보드 설명
  line("{ name: '문제 상황: 다시 시작',", "{ name: '문제 상황: 다시 시작', play: false, desc: '비정상 종료 뒤 다시 켜면 마지막 예배가 그대로 열리고, 출력 상태 복구 창이 켜져 있던 화면, 마지막 장, 표시 중이던 항목을 골라 되살릴지 묻습니다. 예배와 곡은 바꿀 때마다 저장되므로 복구할 것이 없습니다.' }")
  line("{ name: '새 예배 만들기',", "{ name: '새 예배 만들기', play: false, desc: '빈 예배, 틀, 지난 예배 중에서 고르면 가운데에 예배 순서, 오른쪽에 설정이 보이고, 가져올 것을 체크해 만듭니다. 틀에서 시작하면 모두 체크된 상태이고, 체크하지 않은 설정은 지금 예배의 것을 이어 씁니다.' }")
  rep("{ name: '예배 순서에 곡 넣기',", "{ name: '예배 열기', play: false, desc: '예배를 고르면 그 예배의 순서와 설정이 미리 보이고, 열면 화면, Look, 매크로까지 그 예배의 설정으로 바뀝니다.' },\n{ name: '다른 예배에서 가져오기', play: false, desc: '지금 예배는 그대로 두고 다른 예배나 틀에서 고른 것만 더합니다. 예배 순서 항목은 맨 뒤에 붙고, 같은 이름의 설정은 가져온 것으로 바뀝니다. 매크로처럼 여러 개가 든 설정은 펼쳐서 하나씩 고릅니다.' },\n{ name: '예배 순서에 곡 넣기',")
  line("{ name: '가져오기 메뉴',", "{ name: '파일 메뉴', play: false, desc: '저장은 자동이므로 저장 항목이 없습니다. 새 예배, 열기, 최근 예배, 다른 예배에서 가져오기, 지금 예배를 틀로 저장을 두고, 가져오기 아래에 텍스트 파일, 클립보드 텍스트, PowerPoint 파일을 따로 둡니다.' }")

  // 남은 것
  rep('<li>다중 레이어 지우기를 둘지 (비교안: 다중 레이어 지우기)</li>', '<li>다중 레이어 지우기를 둘지 (비교안: 다중 레이어 지우기). 제 의견은 v1에서 빼고 매크로로 대신하는 것</li>\n<li>출력 중에 다른 예배를 열 때: 화면 설정도 함께 바뀌므로 확인을 물을지</li>\n<li>예배 파일의 이름: 지금은 예배. 신은 교회 앱에서 다른 뜻으로 읽힐 수 있고, OBS 한국어판의 장면은 우리 앱의 장(슬라이드)과 헷갈림</li>')
})

// ---------- 캔버스 ----------
const cf = '../llp-design/project/canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
// 준비 기능 줄에서 새 예배를 빼고 뒤의 보드를 당긴다
for (const k of ['AddSongs', 'AddSongsQuick', 'ImportMenu', 'ImportText', 'ImportEdit', 'ImportSave', 'Media']) c.boards[k + '.dc.html'].x -= 2000
c.notes.rowExtra2.maxW -= 2000
c.boards['ImportMenu.dc.html'].title = '파일 메뉴'
// 비교안 줄을 아래로 내리고 그 자리에 예배 파일 줄
c.notes.rowCompare.y = 8200
c.boards['ClearGroups.dc.html'].y = 8500
c.notes.rowService = { x: 1360, y: 6800, text: '예배 파일', kind: 'title1', maxW: 5920, page: 'v2' }
Object.assign(c.boards['NewService.dc.html'], { x: 1360, y: 7100 })
c.boards['ServiceOpen.dc.html'] = { x: 3360, y: 7100, w: 1920, h: 1080, title: '예배 열기', page: 'v2' }
c.boards['ServiceImport.dc.html'] = { x: 5360, y: 7100, w: 1920, h: 1080, title: '다른 예배에서 가져오기', page: 'v2' }
c.order.splice(c.order.indexOf('NewService.dc.html') + 1, 0, 'ServiceOpen.dc.html', 'ServiceImport.dc.html')
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('canvas ok')
