// 8차 수정: NDI 표기, 미리보기 배경, 맞춤 지우기 이름, 가사 가져오기 정리, 대기 후 출력 버튼 위치.
const fs = require('fs')

function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8')
  for (const [a, b, count] of pairs) {
    const n = typeof a === 'string' ? s.split(a).length - 1 : (s.match(new RegExp(a.source, 'g')) || []).length
    if (n !== (count || 1)) throw new Error(file + ': expected ' + (count || 1) + ', found ' + n + ': ' + String(a).slice(0, 80))
    s = typeof a === 'string' ? s.split(a).join(b) : s.replace(new RegExp(a.source, 'g'), () => b)
  }
  fs.writeFileSync(file, s)
  console.log('edited', file)
}

const proj = '../llp-design/project/'
const grayNdi = ['#8c8c8c">캡처용 창</span>', '#8c8c8c">NDI</span>']

// 1. 방송 자막의 대상 표기를 NDI로
edit(proj + 'ShowH.dc.html', [["target: '캡처용 창'", "target: 'NDI'"]])
edit('parts/_bible-center.html', [grayNdi])
edit('src/Compact.html', [grayNdi])
edit('src/Problems.html', [grayNdi])
edit('src/Looks.html', [['캡처용 창', 'NDI', 2]])
edit('src/Outputs.html', [['i-capture"></span>캡처용 창', 'i-capture"></span>NDI']])
edit('src/Screens.html', [
  ['<span style="font-size: 11px; color: #8c8c8c">캡처용 창</span>', '<span style="font-size: 11px; color: #8c8c8c">NDI</span>'],
  ["scr('방송 자막', 'capture', '캡처용 창', false)", "scr('방송 자막', 'capture', 'NDI', false)"],
  ["seg(['전체 화면', '창', '캡처용 창'], 0)", "seg(['전체 화면', '창', '캡처용 창', 'NDI'], 0)"]
])

// 2. NDI 미리보기는 초록 배경을 기본으로, 배경은 고를 수 있게
edit('src/ScreensNDI.html', [
  [/background-color: #262626; background-image: linear-gradient\(45deg[^;]*; background-size: 24px 24px; background-position: [^;]*;/, 'background-color: #00b140;'],
  ['color: #ececec; font-size: 12px">알파 채널</span>', 'color: #ececec; font-size: 12px">NDI 투명</span>'],
  ["row('알파 채널', 'switch', '', sw(true))", "row('알파 채널', 'switch', '', sw(true)),\nrow('미리보기 배경', 'seg', '', { options: seg(['초록', '검정', '체크 무늬'], 0) })"]
])

// 3. 지우기 묶음을 맞춤 지우기로
edit('src/ClearGroups.html', [
  ['@@HEAD:지우기 묶음@@', '@@HEAD:맞춤 지우기@@'],
  ['지우기 묶음 설정', '맞춤 지우기 설정', 3],
  ['aria-label="지우기 묶음 추가"', 'aria-label="맞춤 지우기 추가"'],
  ['aria-label="묶음 추가"', 'aria-label="추가"'],
  ['>묶음 삭제</button>', '>삭제</button>']
])

// 4. 가사 가져오기: 불필요한 칩과 문장형 라벨 정리
edit('src/Import.html', [
  ['<span style="height: 20px; padding: 0 7px; border-radius: 3px; background: {{ f.chipBg }}; color: {{ f.chipFg }}; font-size: 11px; line-height: 20px; white-space: nowrap">{{ f.chip }}</span>',
    '<sc-if value="{{ f.conflict }}" hint-placeholder-val="{{ false }}"><span class="i i14 i-warning" style="color: #e3a23b" title="라이브러리에 있음"></span></sc-if>'],
  ['<span style="display: flex; gap: 8px; font-size: 11px; line-height: 14px; color: {{ f.subColor }}; font-variant-numeric: tabular-nums"><span>{{ f.subA }}</span><span>{{ f.subB }}</span></span>',
    '<span style="font-size: 11px; line-height: 14px; color: {{ f.subColor }}; font-variant-numeric: tabular-nums">{{ f.subA }}</span>'],
  ['<sc-if value="{{ r.hasNote }}" hint-placeholder-val="{{ false }}"><span style="height: 20px; padding: 0 6px; border-radius: 3px; background: #262626; color: #b4b4b4; font-size: 11px; line-height: 20px">{{ r.note }}</span></sc-if>', ''],
  ['<span style="margin-left: auto; font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums">장 4</span>\n<span style="font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums">이름표 3</span>\n', ''],
  ['<span style="font-size: 13px; color: #ececec">라이브러리에 같은 제목</span>', '<span style="font-size: 13px; color: #ececec">라이브러리에 있음</span>'],
  ['font-size: 11px; font-weight: 600; color: #8c8c8c">결과</p>', 'font-size: 11px; font-weight: 600; color: #8c8c8c">장 4</p>'],
  ['font-size: 11px; font-weight: 600; color: #8c8c8c">원본</p>', 'font-size: 11px; font-weight: 600; color: #8c8c8c">파일 내용</p>'],
  ['<span style="height: 22px; padding: 0 8px; border-radius: 3px; background: #262626; color: #ececec; font-size: 12px; line-height: 22px; font-variant-numeric: tabular-nums">새 곡 3</span>\n<span style="height: 22px; padding: 0 8px; border-radius: 3px; background: #262217; color: #e3a23b; font-size: 12px; line-height: 22px; font-variant-numeric: tabular-nums">같은 제목 1</span>\n', ''],
  ['color: #fff; font-size: 13px; font-weight: 600">가져오기</button>', 'color: #fff; font-size: 13px; font-weight: 600">4곡 가져오기</button>'],
  ['const file = (name, kind, sub, chip, sel, conflict) => ({\nname: name, subA: sub[0], subB: sub[1] || \'\', chip: chip, isTxt: kind === \'txt\', isPpt: kind === \'ppt\',',
    'const file = (name, kind, sub, sel, conflict) => ({\nname: name, subA: sub, conflict: conflict, isTxt: kind === \'txt\', isPpt: kind === \'ppt\','],
  ["file('만복의 근원 하나님.txt', 'txt', ['장 4', '이름표 3'], '같은 제목', true, true)", "file('만복의 근원 하나님.txt', 'txt', '4장', true, true)"],
  ["file('은혜 아니면.txt', 'txt', ['장 5', '이름표 3'], '새 곡', false, false)", "file('은혜 아니면.txt', 'txt', '5장', false, false)"],
  ["file('주님 다시 오실 때까지.txt', 'txt', ['장 6', '이름표 4'], '새 곡', false, false)", "file('주님 다시 오실 때까지.txt', 'txt', '6장', false, false)"],
  ["file('10월 찬양.pptx', 'ppt', ['슬라이드 18장'], '새 곡', false, false)", "file('10월 찬양.pptx', 'ppt', '슬라이드 18장', false, false)"],
  ["Object.assign({ label: '이름표 인식', isSwitch: true, hasNote: true, note: '[후렴]' }, sw(true)),\nObject.assign({ label: '첫 줄은 제목', isSwitch: true, hasNote: false }, sw(true))",
    "{ label: '제목', isSeg: true, options: seg(['첫 줄', '파일 이름'], 0) },\nObject.assign({ label: '이름표 인식', isSwitch: true }, sw(true))"],
  [",\nObject.assign({ label: '발표자 메모', isSwitch: true, hasNote: false }, sw(false))", ''],
  ["{ n: 4, label: '이름표 없음', chipBg: '#2a2a2a', chipFg: '#8c8c8c',", "{ n: 4, label: '이름표', chipBg: '#2a2a2a', chipFg: '#8c8c8c',"]
])

// 5. 대기 후 출력: 긴 출력 막대를 빼고, 이지워십의 Go Live처럼 툴바에 출력 버튼을 둔다
edit('build-cuetake.js', [
  ['<button type="button" onClick="{{ take }}" class="hvc" style="height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 4px; background: #d2343a; color: #fff; font-size: 13px; font-weight: 700"><span class="i i-arrow" style="transform: rotate(90deg)"></span>출력</button>\n', ''],
  ["s = s.slice(0, ps) + section + s.slice(pe)", `s = s.slice(0, ps) + section + s.slice(pe)
const lookBtn = '<span class="i i14 i-down" style="color: #8c8c8c"></span></span>평상시</button>'
rep(lookBtn, lookBtn + '\\n<button type="button" onClick="{{ take }}" class="tb" title="출력 Page Down" style="width: 64px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 0; border-radius: 5px; background: transparent; color: #ececec; font-size: 11px; font-weight: 600"><span class="i i18 i-arrow" style="color: #d2343a"></span>출력</button>')`]
])
