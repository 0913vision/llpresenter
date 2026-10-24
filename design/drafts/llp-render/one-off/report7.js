// 보고 페이지를 7차로 갱신하고, 빠른 추가 보드를 캔버스에 넣는다.
const fs = require('fs')
const f = '../llp-design/project/Main.dc.html'
let s = fs.readFileSync(f, 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 60)); s = s.replace(a, () => b) }

rep('시안 보고 6차', '시안 보고 7차')
rep('2026년 10월 24일. 라이브러리 곡 편집과 예배 순서 항목 편집을 나누고, 매크로를 프로프리젠터 방식으로 다시 그렸습니다. 앱 코드는 아직 멈춰 둔 상태입니다.',
  '2026년 10월 24일. 할 일로 정한 추가 시안을 모두 그렸습니다. 문제 상황, 작은 화면, 성경, 새 예배, 곡 넣기, 미디어, 가져오기, 무대 배치, 환경설정과 단축키, 그리고 정할 것을 위한 비교안입니다. 방송 자막은 NDI로 보내기로 했습니다. 앱 코드는 아직 멈춰 둔 상태입니다.')

const boardsHead = '<section style="display: flex; flex-direction: column; gap: 16px">\n<h2 style="margin: 0; font-size: 21px; line-height: 30px; font-weight: 600; color: #f2f2f2">보드 안내</h2>'
rep(boardsHead, `<section style="display: flex; flex-direction: column; gap: 16px">
<h2 style="margin: 0; font-size: 21px; line-height: 30px; font-weight: 600; color: #f2f2f2">프로프리젠터와 다른 점</h2>
<div style="display: flex; flex-direction: column; border-top: 1px solid #2b2b2b">
<div style="display: flex; gap: 24px; padding: 10px 0; border-bottom: 1px solid #2b2b2b; font-size: 13px; color: #8c8c8c"><span style="flex: 0 0 140px">항목</span><span style="flex: 1">프로프리젠터</span><span style="flex: 1">우리 안</span></div>
<sc-for list="{{ compare }}" as="c" hint-placeholder-count="9">
<div style="display: flex; gap: 24px; padding: 14px 0; border-bottom: 1px solid #2b2b2b">
<span style="flex: 0 0 140px; font-weight: 600; color: #f2f2f2">{{ c.topic }}</span>
<span style="flex: 1">{{ c.pp }}</span>
<span style="flex: 1">{{ c.ours }}</span>
</div>
</sc-for>
</div>
</section>

${boardsHead}`)
rep('<sc-for list="{{ boards }}" as="b" hint-placeholder-count="6">', '<sc-for list="{{ boards }}" as="b" hint-placeholder-count="20">')

rep(`<li>처음 켤 때 출력 방식 기본값: 바로 출력 또는 대기 후 출력</li>
<li>성경 구절을 띄우는 방식: copible의 구절 해석을 가져오고, 본문은 오프라인 데이터로 둘 예정</li>
<li>단축키 배치</li>
<li>악보 방식: 별도 축으로 계속 검토</li>`, `<li>처음 켤 때 출력 방식 기본값: 바로 출력 또는 대기 후 출력 (비교안: 대기 후 출력)</li>
<li>지난 구성을 불러오는 방식 (비교안: 구성 불러오기)</li>
<li>사용자 지우기 묶음을 둘지 (비교안: 지우기 묶음)</li>
<li>화면 출력 버튼 표현: 툴팁과 꺼진 상태를 더 분명하게</li>
<li>성경 역본: 개역한글은 공개 본문이고, 개역개정은 대한성서공회 사용 허락을 확인해야 함</li>
<li>NDI SDK를 앱에 넣을 때의 라이선스 조건 확인</li>
<li>악보 방식: 별도 축으로 계속 검토</li>`)

rep("{ title: '방송은 OBS가', desc: '방송 자막은 녹색 배경의 캡처용 창으로만 내보내고, 송출은 OBS가 맡습니다.' },",
  "{ title: '방송 자막은 NDI로', desc: '방송 자막은 알파 채널을 켠 NDI로 OBS에 보내 크로마키 없이 겹칩니다. NDI를 쓸 수 없는 환경을 위해 초록 배경의 캡처용 창을 예비로 둡니다. 송출은 OBS가 맡습니다.' },")
rep("{ title: '단축키는 나중에', desc: '퀵 실행의 단축키 표시는 뺐고, 지우기 버튼의 F1부터 F7은 마우스를 올렸을 때만 보입니다.' }",
  "{ title: '단축키', desc: '퀵 실행의 단축키 표시는 뺐고, 지우기 버튼의 F1부터 F7은 마우스를 올렸을 때만 보입니다. 기본 단축키는 프로프리젠터를 따르고, 환경설정의 단축키 항목에서 바꿉니다.' }")

const newBoards = [
  ['문제 상황: 진행 중', false, '무대 모니터가 빠지면 툴바의 무대 버튼과 상태 표시줄이 주황색으로 바뀌고, 오른쪽 위 알림에서 모니터 다시 찾기와 창 보기를 바로 누를 수 있습니다. 배경 영상 파일이 없으면 미디어 타일과 배경 칩에 파일 없음과 다시 연결이 표시되고, 출력은 정지 화면으로 계속 유지됩니다.'],
  ['문제 상황: 다시 시작', false, '비정상 종료 뒤 다시 켜면 마지막 자동 저장 시각과 함께 예배 순서, 화면 출력, 마지막 장, 표시 중이던 항목을 골라 복구합니다. 다시 시작할 때 출력은 켜되 마지막 장은 바로 띄우지 않는 것을 기본값으로 둡니다. 프로프리젠터에는 해당 기능이 없어 우리 쪽 설계입니다.'],
  ['진행 화면 1366×768', false, '노트북 화면에서는 툴바를 한 줄로 줄이고 미디어 칸을 닫은 채로 시작하며, 왼쪽과 오른쪽 열을 좁히고 썸네일을 3열로 보입니다. 지우기 버튼은 아이콘만 남기고 진행 도구 탭 일부는 더 보기로 넘깁니다.'],
  ['성경 구절 띄우기', false, '퀵 실행에 요 3:16-18처럼 입력하면 구절 후보와 최근 구절이 뜨고, 가운데에 역본, 나누기 방식, 참조 위치를 고를 수 있는 성경 장들이 바로 만들어집니다. 본 화면과 방송 자막에서 어떻게 보일지 확인한 뒤 바로 띄우거나 예배 순서에 넣습니다. 본문은 개역한글입니다.'],
  ['새 예배 만들기', false, '빈 예배, 틀, 지난 예배 복제 중에서 고르면 오른쪽에 그 예배 순서의 구조가 미리 보이고, 아래에서 이름, 날짜, 시간을 정합니다. 틀에는 고정 항목과 곡이나 구절을 나중에 채울 빈 자리가 함께 들어갑니다.'],
  ['예배 순서에 곡 넣기', false, '라이브러리의 곡을 예배 순서로 끌면 들어갈 자리에 파란 선이 나타납니다. 예배 순서 머리글의 더하기를 누르면 검색 창이 열려 곡을 바로 찾고, 머리글, 빈 자리, 성경 구절, 미디어, 공지도 넣을 수 있습니다.'],
  ['가사 가져오기', false, '끌어다 놓은 txt와 pptx 파일을 목록으로 보여 주고, 고른 파일의 원본과 장으로 나뉜 결과를 나란히 비교합니다. 장 나누기 방식, 한 장 최대 줄 수, 이름표 인식을 정하고, 같은 제목이 있으면 덮어쓰기, 새 곡으로, 건너뛰기 중에서 고릅니다.'],
  ['미디어 가져오기와 재생목록', false, '미디어 재생목록과 오디오 재생목록을 왼쪽에 두고, 가운데에 길이와 반복 여부가 보이는 썸네일과 복사 중인 파일의 진행 상태를 보여 줍니다. 오른쪽 속성 패널에서 재생 구간, 끝나면 반복 또는 멈춤, 화면 맞춤, 소리, 파일 위치를 정합니다.'],
  ['무대 화면 배치 편집', false, '프로프리젠터의 무대 배치 편집기를 따랐습니다. 가운데 16:9 캔버스에서 현재 가사, 다음 가사, 이름표, 시계, 타이머, 무대 메시지를 옮기고 크기를 바꾸며, 오른쪽에서 글꼴, 크기, 색, 정렬을 정합니다.'],
  ['환경설정과 단축키', true, '왼쪽 목록에서 일반, 출력, 라이브러리, 성경, 가져오기, 단축키, 업데이트를 고릅니다. 단축키는 바꾼 것과 겹침만 걸러 볼 수 있고, 겹치는 키는 주황 테두리와 상대 명령 이름으로 표시합니다.'],
  ['화면 설정: 방송 자막 NDI', false, '방송 자막의 방식에 NDI를 더했습니다. 알파 채널을 켜면 초록 배경 없이 투명 배경으로 보내므로 OBS에서 크로마키가 필요 없습니다.'],
  ['비교안: 대기 후 출력', true, '장을 한 번 누르면 대기에 올라가고, 출력 버튼을 눌러야 화면에 나갑니다. 프로프리젠터에는 없는 방식이라 이지워십의 미리보기와 출력 방식을 따랐고, 다른 화면의 작은 미리보기가 빠지는 대신 대기와 출력 중 화면을 위아래로 봅니다.'],
  ['비교안: 구성 불러오기', false, '예배 순서 항목의 구성 옆 메뉴에서 지난 예배의 구성을 장 색 막대로 미리 보고 고릅니다. 프로프리젠터는 구성을 곡 파일에 저장하지만, 곡 파일에는 가사만 두기로 했으므로 지난 예배에서 가져옵니다.'],
  ['비교안: 지우기 묶음', false, '프로프리젠터 7.7의 지우기 묶음 설정 창을 따랐습니다. 묶음마다 이름, 아이콘, 색, 지울 레이어를 정하고, 진행 화면에서는 기본 지우기 줄 아래에 사용자 묶음 줄이 하나 더 생깁니다.']
]
const lastBoard = "{ name: '세 화면의 실제 출력', play: false, desc: '평상시 Look에서 같은 순간 본 화면, 무대 화면, 방송 자막의 모습입니다.' }"
rep(lastBoard, lastBoard + ',\n' + newBoards.map((b) => `{ name: '${b[0]}', play: ${b[1]}, desc: '${b[2]}' }`).join(',\n'))

const compare = [
  ['출력 방식', '장을 누르면 바로 출력', '같은 방식이 기본, 대기 후 출력은 비교안'],
  ['곡 구성', '곡 파일 안에 구성 여러 개 저장', '곡 파일에는 가사만, 구성은 예배 순서 항목에 저장'],
  ['무대 화면', 'Look은 청중 화면에만, 무대는 별도 배치 편집기', '무대도 Look에서 켜고 끄며, 배치는 무대 배치 편집기에서'],
  ['지우기', '레이어별 지우기와 사용자 지우기 묶음', '레이어별 일곱 개, 사용자 묶음은 비교안'],
  ['방송 출력', 'NDI 출력 지원', 'NDI로 보내고 캡처용 창은 예비'],
  ['매크로 편집', '우클릭 메뉴와 동작 팔레트', '같은 방식'],
  ['성경', '별도 성경 모드에서 구절 찾기', '퀵 실행 입력 칸에서 바로 찾기'],
  ['비정상 종료', '자동 복구 기능 없음', '다시 켤 때 복구 창'],
  ['작은 화면', '사이드바와 진행 도구를 접음', '같은 방향으로 1366×768 배치를 따로 정함']
]
rep('boards: [', 'compare: [\n' + compare.map((c) => `{ topic: '${c[0]}', pp: '${c[1]}', ours: '${c[2]}' }`).join(',\n') + '\n],\nboards: [')

s = s.replace('min-height: 2800px', 'min-height: 4600px').replace('"height":2800', '"height":4600')
if (/[·—]/.test(s)) throw new Error('middle dot or em dash found')
fs.writeFileSync(f, s)

const cf = '../llp-design/project/canvas.json'
const c = JSON.parse(fs.readFileSync(cf, 'utf8'))
c.boards['AddSongs.dc.html'].title = '예배 순서에 곡 넣기: 끌어 넣기'
c.boards['AddSongsQuick.dc.html'] = { x: 7360, y: 4300, w: 1920, h: 1080, title: '예배 순서에 곡 넣기: 빠른 추가', page: 'v2' }
if (!c.order.includes('AddSongsQuick.dc.html')) c.order.splice(c.order.indexOf('AddSongs.dc.html') + 1, 0, 'AddSongsQuick.dc.html')
c.boards['Import.dc.html'].x = 9360
c.boards['Media.dc.html'].x = 11360
c.notes.rowExtra2.maxW = 11920
c.boards['Main.dc.html'].h = 4600
fs.writeFileSync(cf, JSON.stringify(c, null, 2) + '\n')
console.log('ok', Object.keys(c.boards).length, 'boards')
