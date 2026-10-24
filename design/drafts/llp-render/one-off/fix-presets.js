// 곡 구성을 곡에 저장된 프리셋으로 바꾼다. 예배 순서 항목은 프리셋을 고르고, 라이브러리 곡 편집기에는 프리셋 줄을 둔다.
const fs = require('fs')
function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8')
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw new Error(file + ': not unique: ' + a.slice(0, 80))
    s = s.replace(a, () => b)
  }
  fs.writeFileSync(file, s)
  console.log('edited', file)
}

// 예배 순서 항목: 구성 프리셋 고르기
edit('src/PrepService.html', [
  ['<div style="display: flex; align-items: center; gap: 10px; height: 24px">\n<span style="font-size: 12px; font-weight: 600">구성</span>\n<span style="font-size: 12px; color: #8c8c8c">이번 예배</span>\n<button type="button" class="hv" style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; font-size: 12px"><span class="i i14 i-undo"></span>파일 순서로</button>\n</div>',
    '<div style="display: flex; align-items: center; gap: 10px; height: 26px">\n<span style="font-size: 12px; font-weight: 600">구성</span>\n<button type="button" class="hvc" aria-haspopup="menu" style="display: inline-flex; align-items: center; gap: 8px; height: 26px; padding: 0 6px 0 10px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 12px">주일용<span class="i i12 i-down" style="color: #8c8c8c"></span></button>\n</div>'],
  ['<div style="display: flex; align-items: center; gap: 12px; height: 36px">\n<span style="flex: 0 0 84px; font-size: 12px; color: #b4b4b4">가사와 이름표</span>\n<span style="flex: 1; font-size: 13px; color: #b4b4b4">원본을 따름</span>\n</div>\n', '']
])

// 라이브러리 곡 편집기: 곡에 저장된 구성 프리셋 줄
edit('src/Reflow.html', [
  ['<div style="flex: 1; min-height: 0; padding: 8px 0">',
    `<div style="flex: none; height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 14px; border-bottom: 1px solid #2b2b2b">
<span style="font-size: 12px; font-weight: 600">구성</span>
<span style="display: flex; padding: 2px; border-radius: 5px; background: #121212"><sc-for list="{{ presets }}" as="p" hint-placeholder-count="3"><button type="button" style="height: 24px; padding: 0 12px; border: 0; border-radius: 3px; background: {{ p.bg }}; color: {{ p.fg }}; font-size: 12px">{{ p.name }}</button></sc-for></span>
<button type="button" class="hv" aria-label="구성 추가" style="width: 26px; height: 26px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; display: inline-flex; align-items: center; justify-content: center"><span class="i i-plus"></span></button>
</div>
<div style="flex: 1; min-height: 0; padding: 8px 0">`],
  ['return {\nblocks: blocks,', "const presets = ['기본', '주일용', '짧게'].map((n, i) => ({ name: n, bg: i === 0 ? '#333333' : 'transparent', fg: i === 0 ? '#ececec' : '#8c8c8c' }));\nreturn {\npresets: presets,\nblocks: blocks,"]
])
// 이름표 선택 창은 구성 줄만큼 아래로
edit('src/Reflow.html', [['<div role="menu" aria-label="이름표" style="position: absolute; left: 48px; top: 258px;', '<div role="menu" aria-label="이름표" style="position: absolute; left: 48px; top: 302px;']])

// 가져온 곡에는 기본 구성만 있다
edit('build-import-edit.js', [["rep(\"const sel = l[0] === '만복의 근원 하나님';\", 'const sel = false;')",
  "rep(\"const sel = l[0] === '만복의 근원 하나님';\", 'const sel = false;')\nrep(\"const presets = ['기본', '주일용', '짧게']\", \"const presets = ['기본']\")"]])
