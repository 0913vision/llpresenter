// 성경 구절, 새 예배, 곡 넣기 보드의 src를 기존 보드에서 만들어 낸다.
// 사용: node make-fork-a.js
const fs = require('fs')

function rep(s, a, b, label) {
  const n = s.split(a).length - 1
  if (n !== 1) throw new Error((label || 'replace') + ': found ' + n + ' times: ' + a.slice(0, 90))
  return s.replace(a, () => b)
}

// ---------- 성경 구절 띄우기 (진행 화면 기반) ----------
{
  let s = fs.readFileSync('../llp-design/project/ShowH.dc.html', 'utf8')
  s = rep(s, '<title>진행 화면</title>', '<title>성경 구절 띄우기</title>')
  {
    // 최신 아이콘 목록은 이 스크립트가 만든 새 예배 보드의 머리에서 가져온다.
    const prepBuilt = fs.readFileSync('../llp-design/project/NewService.dc.html', 'utf8')
    const icons = prepBuilt.slice(prepBuilt.indexOf('.i12{'), prepBuilt.indexOf('</style>'))
    const a = s.indexOf('.i14{'), b = s.indexOf('</style>')
    if (a < 0 || b < 0 || !icons) throw new Error('icon css')
    s = s.slice(0, a) + icons + s.slice(b)
  }
  s = rep(s, "live: 1, size: 6, big: 'main', bin: true,", "live: 1, size: 6, big: 'main', bin: false,")
  s = rep(s, '<div style="flex: 0 0 280px; display: flex; flex-direction: column; gap: 4px">', '<div style="position: relative; flex: 0 0 280px; display: flex; flex-direction: column; gap: 4px">')
  s = rep(s,
    '<span style="display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border-radius: 4px; background: #121212; color: #8c8c8c"><span class="i i-book"></span><input id="h-verse" placeholder="요 3:16, 창 1:1-5" style="flex: 1; min-width: 0; height: 28px; padding: 0; border: 0; background: transparent; color: #ececec; font-size: 13px"></span>',
    '<span style="display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px; border-radius: 4px; background: #121212; box-shadow: inset 0 0 0 1px #3d8bf0; color: #8c8c8c"><span class="i i-book"></span><input id="h-verse" value="요 3:16-18" placeholder="요 3:16, 창 1:1-5" style="flex: 1; min-width: 0; height: 28px; padding: 0; border: 0; background: transparent; color: #ececec; font-size: 13px"></span>')
  const center = fs.readFileSync('parts/_bible-center.html', 'utf8')
  const cs = s.indexOf('<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">')
  const ce = s.indexOf('<div style="flex: 0 0 480px; display: flex; flex-direction: column; gap: 4px">')
  if (cs < 0 || ce < 0) throw new Error('center markers')
  s = s.slice(0, cs) + center + '\n' + s.slice(ce)
  const popover = fs.readFileSync('parts/_bible-suggest.html', 'utf8')
  s = rep(s, '</ul>\n</section>\n</div>\n\n<div style="flex: 1; min-width: 0;', '</ul>\n</section>\n' + popover + '</div>\n\n<div style="flex: 1; min-width: 0;')
  s = rep(s, 'return {\non: on, big: big,', fs.readFileSync('parts/_bible-data.js', 'utf8') + 'return {\nbible: bible,\non: on, big: big,')
  fs.writeFileSync('src/Bible.html', s)
  console.log('wrote src/Bible.html')
}

// ---------- 준비 화면 기반 보드 ----------
const prep = fs.readFileSync('src/PrepService.html', 'utf8')
const leftEnd = '</div>\n\n<section style="flex: 1; min-width: 0; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="예배 순서 항목">'

function prepBase(title) {
  let s = prep
  s = rep(s, '@@HEAD:예배 순서 항목@@', '@@HEAD:' + title + '@@')
  s = rep(s, '<div style="width: 1920px; height: 1080px; display: flex; flex-direction: column;', '<div style="position: relative; width: 1920px; height: 1080px; display: flex; flex-direction: column;')
  s = rep(s, '<div style="flex: 0 0 280px; display: flex; flex-direction: column; gap: 4px">', '<div style="position: relative; flex: 0 0 280px; display: flex; flex-direction: column; gap: 4px">')
  return s
}

// 라이브러리 줄 선택 표시와 예배 순서 넣을 위치 표시를 받을 수 있게 바꾼다.
function withInsertion(s, draggedTitle) {
  s = rep(s,
    '<li><button type="button" class="hv" style="display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 14px; border: 0; background: transparent; color: #ececec; text-align: left; font-size: 13px">\n<span class="i i-song" style="color: #b4b4b4"></span>\n<span style="flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">{{ l.title }}</span>\n<span style="font-size: 11px; color: #8c8c8c; font-variant-numeric: tabular-nums">{{ l.count }}</span>',
    '<li><button type="button" class="hv" style="display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 14px; border: 0; background: {{ l.bg }}; color: #ececec; text-align: left; font-size: 13px">\n<span class="i i-song" style="color: {{ l.iconColor }}"></span>\n<span style="flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">{{ l.title }}</span>\n<span style="font-size: 11px; color: {{ l.countColor }}; font-variant-numeric: tabular-nums">{{ l.count }}</span>')
  s = rep(s, '</button>\n</sc-if>\n</li>\n</sc-for>\n</ol>',
    '</button>\n</sc-if>\n<sc-if value="{{ p.insert }}" hint-placeholder-val="{{ false }}"><div aria-hidden="true" style="position: relative; height: 0"><span style="position: absolute; left: 12px; right: 12px; top: -1px; height: 2px; border-radius: 1px; background: #3d8bf0"></span><span style="position: absolute; left: 8px; top: -4px; width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; border: 2px solid #3d8bf0; background: #1c1c1c"></span></div></sc-if>\n</li>\n</sc-for>\n</ol>')
  s = rep(s, "item('내 주를 가까이 하게 함은', 'song', '5장'),", "Object.assign(item('내 주를 가까이 하게 함은', 'song', '5장'), { insert: true }),")
  s = rep(s, "].map((l) => ({ title: l[0], count: l[1] }))",
    "].map((l) => {\nconst sel = l[0] === '" + draggedTitle + "';\nreturn { title: l[0], count: l[1], bg: sel ? '#1f4170' : 'transparent', iconColor: sel ? '#ececec' : '#b4b4b4', countColor: sel ? '#b4c6e0' : '#8c8c8c' };\n})")
  return s
}

{
  let s = prepBase('새 예배 만들기')
  s = rep(s, '\n</div>\n</x-dc>', '\n' + fs.readFileSync('parts/_newservice-dialog.html', 'utf8') + '</div>\n</x-dc>')
  s = rep(s, 'return {\nsequence: sequence,', fs.readFileSync('parts/_newservice-data.js', 'utf8') + 'return {\nnewService: newService,\nsequence: sequence,')
  fs.writeFileSync('src/NewService.html', s)
  console.log('wrote src/NewService.html')
}

{
  let s = withInsertion(prepBase('예배 순서에 곡 넣기'), '주 하나님 지으신 모든 세계')
  s = rep(s, leftEnd, fs.readFileSync('parts/_addsongs-ghost.html', 'utf8') + leftEnd)
  fs.writeFileSync('src/AddSongs.html', s)
  console.log('wrote src/AddSongs.html')
}

{
  let s = withInsertion(prepBase('예배 순서 빠른 추가'), '')
  s = rep(s, 'aria-label="항목 추가" style="margin-left: auto; width: 26px; height: 26px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4;', 'aria-label="항목 추가" aria-expanded="true" style="margin-left: auto; width: 26px; height: 26px; border: 0; border-radius: 4px; background: #333333; color: #ececec;')
  s = rep(s, leftEnd, fs.readFileSync('parts/_addsongs-quick.html', 'utf8') + leftEnd)
  s = rep(s, 'return {\nsequence: sequence,', fs.readFileSync('parts/_addsongs-quick-data.js', 'utf8') + 'return {\nquick: quickAdd,\nsequence: sequence,')
  fs.writeFileSync('src/AddSongsQuick.html', s)
  console.log('wrote src/AddSongsQuick.html')
}
