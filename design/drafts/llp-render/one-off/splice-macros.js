// Macros.html의 편집 창을 우클릭 메뉴가 열린 격자 보기와 동작 팔레트로 바꾼다.
const fs = require('fs')
let s = fs.readFileSync('src/Macros.html', 'utf8')
const block = fs.readFileSync('src/_macro-menu.html', 'utf8')
const p1s = s.indexOf('<section style="flex: none; width: 480px; height: 391px; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="매크로 격자 보기">')
const p1e = s.indexOf('</section>', p1s) + '</section>'.length
const panel = s.slice(p1s, p1e).replace('aria-label="매크로 격자 보기"', 'aria-label="매크로 우클릭 메뉴"')
const ds = s.indexOf('<section role="dialog"')
const de = s.indexOf('</section>', ds) + '</section>'.length
if (p1s < 0 || ds < 0) throw new Error('marker')
s = s.slice(0, ds) + block.replace('@@PANEL@@', panel).trimEnd() + s.slice(de)
s = s.replace('width: 1504px; height: 658px;', 'width: 1780px; height: 580px;').replace('"$preview":{"width":1504,"height":658}', '"$preview":{"width":1780,"height":580}')
fs.writeFileSync('src/Macros.html', s)
console.log('ok')
