// 설명 문구와 군더더기 상태 표시를 걷어낸다. 결정에 따라 출력 방식 설정과 같은 제목 처리 설정도 뺀다.
const fs = require('fs')

function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8')
  for (const [a, b, count] of pairs) {
    const n = s.split(a).length - 1
    if (n !== (count || 1)) throw new Error(file + ': expected ' + (count || 1) + ', found ' + n + ': ' + a.slice(0, 90))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(file, s)
  console.log('edited', file)
}
function cutBetween(file, startKey, endKey, keepEnd) {
  let s = fs.readFileSync(file, 'utf8')
  const a = s.indexOf(startKey)
  const b = s.indexOf(endKey, a + startKey.length)
  if (a < 0 || b < 0) throw new Error(file + ': markers ' + startKey.slice(0, 40))
  s = s.slice(0, a) + s.slice(keepEnd ? b : b + endKey.length)
  fs.writeFileSync(file, s)
  console.log('cut', file)
}

// 빠른 추가: 넣을 위치 줄(파란 선으로 이미 보임)
cutBetween('parts/_addsongs-quick.html', '<div style="height: 1px; margin: 6px 2px; background: #3a3a3a"></div>\n<div style="display: flex; align-items: center; gap: 10px; height: 28px; padding: 0 8px; font-size: 12px"><span style="color: #8c8c8c">넣을 위치</span>', '</div>\n', false)

// 매크로 목록: 방금 실행 문구 (줄 배경으로 이미 보임)
edit('src/Macros.html', [['<sc-if value="{{ m.isLast }}" hint-placeholder-val="{{ false }}"><span style="font-size: 11px; color: #8c8c8c">방금 실행</span></sc-if>', '']])

// 실제 출력: NDI로 보내므로 초록 배경 칩은 맞지 않음
edit('src/Outputs.html', [["bcLayers: ['하단 자막', '초록 배경']", "bcLayers: ['하단 자막']"]])

// 문제 상황: 미디어 머리글의 파일 없음 개수 (타일에 이미 보임)
edit('src/Problems.html', [['<span style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #e3a23b"><span class="i i14 i-warning"></span>파일 없음 1</span>\n', '']])

// 복구 창: 저장 전 변경, 다시 시작할 때, 오류 기록을 빼고 복구할 상태만 남긴다
cutBetween('src/Recovery.html', '<div style="padding: 0 20px">\n<p style="margin: 0; padding: 12px 0 6px; border-top: 1px solid #2b2b2b; font-size: 11px; line-height: 14px; font-weight: 600; color: #8c8c8c">저장 전 변경</p>',
  '<div style="display: flex; align-items: center; gap: 8px; height: 60px; padding: 0 20px; border-top: 1px solid #2b2b2b">', true)
edit('src/Recovery.html', [
  ['<button type="button" class="hv" style="display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 8px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; font-size: 12px"><span class="i i14 i-folderopen"></span>오류 기록</button>\n', ''],
  ['font-size: 13px; font-weight: 600">복구하고 시작</button>', 'font-size: 13px; font-weight: 600">복구</button>'],
  ['<div style="padding: 0 20px">\n<p style="margin: 0; padding: 12px 0 6px; border-top: 1px solid #2b2b2b; font-size: 11px; line-height: 14px; font-weight: 600; color: #8c8c8c">복구할 상태</p>',
    '<div style="padding: 0 20px 10px">\n<p style="margin: 0; padding: 12px 0 6px; border-top: 1px solid #2b2b2b; font-size: 11px; line-height: 14px; font-weight: 600; color: #8c8c8c">복구할 상태</p>']
])

// NDI: 상태는 출력 배치의 NDI 상자에 이미 보이므로 속성의 상태 묶음은 뺀다
edit('src/ScreensNDI.html', [[",\n{ title: '상태', rows: [\nrow('보내기', 'text', '보내는 중', { dot: '#3dbb6b' }),\nrow('수신', 'text', '1곳')\n] }", '']])

// 환경설정과 단축키: 결정된 것과 군더더기 정리
for (const f of ['src/Prefs.html', 'src/Shortcuts.html']) {
  edit(f, [
    ["seg('처음 켤 때 출력 방식', ['바로 출력', '대기 후 출력'], 0), ", ''],
    [",\ngroup('같은 제목이 있으면', [sel('처리', '새 곡으로 추가')])", ''],
    ["{ name: '개역개정', lang: '한국어', size: '4.4MB', isDefault: true, more: '개역개정 메뉴' },\n{ name: '새번역', lang: '한국어', size: '4.6MB', isDefault: false, more: '새번역 메뉴' },",
      "{ name: '개역한글', lang: '한국어', size: '4.3MB', isDefault: true, more: '개역한글 메뉴' },"],
    ['<span style="display: inline-flex; align-items: center; gap: 5px; margin-left: 4px; font-size: 12px; color: #e3a23b"><span class="i i14 i-warning"></span>{{ k.conflict }}</span>',
      '<span title="{{ k.conflict }}" style="display: inline-flex; margin-left: 4px; color: #e3a23b"><span class="i i14 i-warning"></span></span>']
  ])
}
