// 예배 순서 항목(PrepService)을 바탕으로 구성 불러오기 비교안(PrepArrange)을 만든다.
const fs = require('fs')
let s = fs.readFileSync('src/PrepService.html', 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 60)); s = s.replace(a, () => b) }
rep('@@HEAD:예배 순서 항목@@', '@@HEAD:구성 불러오기@@')
rep('<section style="flex: 1; min-width: 0; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="예배 순서 항목">',
  '<section style="position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="예배 순서 항목">')
rep('<button type="button" class="hv" style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; font-size: 12px"><span class="i i14 i-undo"></span>파일 순서로</button>',
  '<button type="button" class="hvc" aria-haspopup="menu" aria-expanded="true" style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 6px 0 8px; border: 0; border-radius: 4px; background: #333333; color: #ececec; font-size: 12px"><span class="i i14 i-history"></span>구성 불러오기<span class="i i12 i-down" style="color: #8c8c8c"></span></button>')
const menu = `
<div role="menu" aria-label="구성 불러오기" style="position: absolute; right: 14px; top: 76px; width: 380px; padding: 6px; box-sizing: border-box; border-radius: 6px; background: #262626; box-shadow: 0 0 0 1px #3a3a3a, 0 8px 24px rgba(0, 0, 0, 0.5)">
<sc-for list="{{ arrangeMenu }}" as="g" hint-placeholder-count="2">
<p style="margin: 0; padding: 8px 8px 4px; font-size: 11px; line-height: 14px; font-weight: 600; color: #8c8c8c">{{ g.title }}</p>
<sc-for list="{{ g.items }}" as="m" hint-placeholder-count="3">
<button type="button" role="menuitem" class="hv" style="display: flex; flex-direction: column; align-items: stretch; gap: 7px; width: 100%; padding: 8px; border: 0; border-radius: 4px; background: {{ m.bg }}; color: #ececec; text-align: left">
<span style="display: flex; align-items: center; gap: 8px; font-size: 13px"><span style="flex: 1">{{ m.name }}</span><span style="font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums">{{ m.count }}</span><span style="width: 14px; display: inline-flex"><sc-if value="{{ m.current }}" hint-placeholder-val="{{ false }}"><span class="i i14 i-check"></span></sc-if></span></span>
<span style="display: flex; gap: 2px"><sc-for list="{{ m.bars }}" as="b" hint-placeholder-count="9"><span style="width: 22px; height: 6px; border-radius: 1px; background: {{ b }}"></span></sc-for></span>
</button>
</sc-for>
</sc-for>
<div style="height: 1px; margin: 6px 2px; background: #3a3a3a"></div>
<button type="button" class="hv" style="display: flex; align-items: center; gap: 10px; width: 100%; height: 30px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; font-size: 13px; text-align: left"><span class="i i14 i-undo"></span>파일 순서로 되돌리기</button>
</div>
</section>`
const secStart = s.indexOf('aria-label="예배 순서 항목">')
const secEnd = s.indexOf('</section>', secStart)
s = s.slice(0, secEnd) + menu.trim().replace(/<\/section>$/, '') + '\n' + s.slice(secEnd)
rep('return {\nsequence: sequence,', `const colorOf = (k) => labels[k][1] || '#4a4a4a';
const arr = (name, list, current, extra) => Object.assign({ name: name, count: list.length + '장', bars: list.map(colorOf), current: current, bg: current ? '#333333' : 'transparent' }, extra || {});
return {
arrangeMenu: [
{ title: '지난 예배', items: [
arr('10월 19일 주일 예배', [0, 1, 2, 3, 1, 2, 3, 2, 3], true),
arr('10월 5일 주일 예배', [0, 1, 2, 3, 2, 3], false),
arr('9월 26일 금요 기도회', [1, 2, 3, 1, 2, 3, 2, 3], false)
] },
{ title: '파일 순서', items: [arr('만복의 근원 하나님', [0, 1, 2, 3], false)] }
],
sequence: sequence,`)
fs.writeFileSync('src/PrepArrange.html', s)
console.log('ok')
