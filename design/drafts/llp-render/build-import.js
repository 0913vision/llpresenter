// 가사 가져오기를 프로프리젠터 방식으로 다시 만든다.
// ImportText: 텍스트 파일 하나씩 장 나누기를 확인하는 창. ImportMenu: 파일 메뉴의 가져오기 하위 메뉴.
const fs = require('fs')

// 1. 이전 판(src/Import.html)의 흐린 준비 화면 배경을 그대로 쓰고, 창과 데이터만 바꾼다.
const old = fs.readFileSync('src/Import.html', 'utf8')
const bgEnd = old.indexOf('<section role="dialog"')
let bg = old.slice(0, bgEnd).replace('@@HEAD:가사 가져오기@@', '@@HEAD:텍스트 가져오기@@')
const dialog = fs.readFileSync('parts-local/_import-text-dialog.html', 'utf8').trim()
const tailStart = old.indexOf('</section>', bgEnd) + '</section>'.length
const scriptStart = old.indexOf('<script type="text/x-dc"')
const between = old.slice(tailStart, scriptStart)
const script = `<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1920,"height":1080}}'>
class Component extends DCLogic {
renderVals() {
const pal = { teal: '#5fb8c2', green: '#8fbf7a', yellow: '#d6b35f' };
const seg = (labels, active) => labels.map((l, i) => ({ label: l, bg: i === active ? '#333333' : 'transparent', fg: i === active ? '#ececec' : '#8c8c8c' }));
const slide = (n, label, color, text) => ({ n: n, label: label, text: text, barBg: color || '#2a2a2a', barFg: color ? '#101010' : '#a3a3a3' });
return {
bgOrder: ['예배 전 카운트다운', '주일 광고', '이 세상 험하고', '만복의 근원 하나님', '내 주를 가까이 하게 함은', '요한복음 3장 16절', '설교', '축도'],
bgLibrary: ['거리마다 기쁨으로', '나 같은 죄인 살리신', '나를 향한 주의 사랑', '내 주를 가까이 하게 함은', '송축해 내 영혼', '십자가 그 사랑', '예수 사랑하심은', '만복의 근원 하나님', '은혜 아니면', '이 세상 험하고', '주 하나님 지으신 모든 세계', '하나님 은혜'],
bgBlocks: [
{ label: '1절', color: pal.teal, text: '만복의 근원 하나님\\n온 백성 찬송 드리고' },
{ label: '프리코러스', color: pal.green, text: '저 천사여 찬송하세\\n찬송 성부 성자 성령' },
{ label: '후렴', color: pal.yellow, text: '찬송 성부 성자 성령\\n아멘' }
],
split: seg(['빈 줄', '줄 바꿈', '기호'], 0),
slides: [
slide(1, '1절', pal.teal, '만복의 근원 하나님\\n온 백성 찬송 드리고'),
slide(2, '프리코러스', pal.green, '저 천사여 찬송하세\\n찬송 성부 성자 성령'),
slide(3, '후렴', pal.yellow, '찬송 성부 성자 성령\\n아멘'),
slide(4, '', null, '찬송 성부 성자 성령\\n만복의 근원 하나님')
]
};
}
}
</script>
</body>
</html>
`
fs.writeFileSync('src/ImportText.html', bg + dialog + between + script)

// 2. 파일 메뉴의 가져오기 하위 메뉴 (작은 보드)
const menuItem = (label, opts = {}) => opts.sep ? '<div style="height: 1px; margin: 4px 2px; background: #3a3a3a"></div>'
  : `<button type="button" role="menuitem" class="hv" style="display: flex; align-items: center; gap: 10px; width: 100%; height: 28px; padding: 0 8px; border: 0; border-radius: 4px; background: ${opts.on ? '#333333' : 'transparent'}; color: #ececec; font-size: 13px; text-align: left">${opts.icon ? `<span class="i i-${opts.icon}" style="color: #b4b4b4"></span>` : ''}<span style="flex: 1">${label}</span>${opts.sub ? '<span class="i i12 i-right" style="color: #8c8c8c"></span>' : ''}</button>`
const fileMenu = [
  menuItem('새 예배'), menuItem('열기'), menuItem('최근 예배', { sub: true }), menuItem('', { sep: true }),
  menuItem('저장'), menuItem('다른 이름으로 저장'), menuItem('', { sep: true }),
  menuItem('가져오기', { sub: true, on: true }), menuItem('내보내기', { sub: true }), menuItem('', { sep: true }),
  menuItem('환경설정')
].join('\n')
const importMenu = [
  menuItem('텍스트 파일', { icon: 'filetext' }), menuItem('클립보드 텍스트', { icon: 'copy' }), menuItem('', { sep: true }),
  menuItem('PowerPoint 파일', { icon: 'fileppt' })
].join('\n')
const menuBox = (left, top, width, inner, label) => `<div role="menu" aria-label="${label}" style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; padding: 6px; box-sizing: border-box; border-radius: 6px; background: #262626; box-shadow: 0 0 0 1px #3a3a3a, 0 8px 24px rgba(0, 0, 0, 0.5)">\n${inner}\n</div>`
const menuBoard = `@@HEAD:가져오기 메뉴@@
<div style="position: relative; width: 760px; height: 420px; display: flex; flex-direction: column; background: #0e0e0e; color: #ececec; font-family: 'Pretendard Variable', Pretendard, sans-serif; font-size: 13px; line-height: 18px; word-break: keep-all; -webkit-font-smoothing: antialiased; overflow: hidden">
<div style="flex: none; height: 30px; display: flex; align-items: center; padding-left: 12px; background: #0b0b0b">
<span style="margin-right: 14px; font-size: 12px; font-weight: 700; letter-spacing: -0.01em">LoveLight</span>
<nav style="display: flex; font-size: 12px; color: #b4b4b4" aria-label="메뉴">
<button type="button" style="height: 24px; padding: 0 9px; border: 0; border-radius: 3px; background: #262626; color: #ececec">파일</button>
<button type="button" class="hv" style="height: 24px; padding: 0 9px; border: 0; border-radius: 3px; background: transparent; color: inherit">편집</button>
<button type="button" class="hv" style="height: 24px; padding: 0 9px; border: 0; border-radius: 3px; background: transparent; color: inherit">보기</button>
<button type="button" class="hv" style="height: 24px; padding: 0 9px; border: 0; border-radius: 3px; background: transparent; color: inherit">출력</button>
</nav>
</div>
<div style="flex: 1; margin: 0 4px 4px; border-radius: 5px; background: #161616"></div>
${menuBox(84, 30, 220, fileMenu, '파일')}
${menuBox(300, 214, 220, importMenu, '가져오기')}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":420}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
`
fs.writeFileSync('src/ImportMenu.html', menuBoard)
console.log('ok')
