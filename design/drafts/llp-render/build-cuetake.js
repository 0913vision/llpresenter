// 진행 화면(ShowH)을 바탕으로 대기 후 출력 비교안(CueTake)을 만든다.
const fs = require('fs')
const dir = '../llp-design/project/'
let s = fs.readFileSync(dir + 'ShowH.dc.html', 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 60)); s = s.replace(a, () => b) }
rep('<title>진행 화면</title>', '<title>대기 후 출력</title>')
const ps = s.indexOf('<section style="flex: none; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="미리보기">')
const pe = s.indexOf('</section>', ps) + '</section>'.length
const frame = (shadow, inner) => `<div style="position: relative; aspect-ratio: 16 / 9; border-radius: 3px; overflow: hidden; background: #000; box-shadow: 0 0 0 2px ${shadow}">\n${inner}\n</div>`
const bokeh = '<img src="/_blob/e96d6204449f1e44237721b22d7463c9" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover">'
const text = (v) => `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 36px; color: #fff; font-size: 19px; line-height: 27px; font-weight: 700; text-align: center; white-space: pre-line; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6)">{{ ${v} }}</div>`
const label = (dot, name, nameKey, posKey) => `<div style="display: flex; align-items: center; gap: 8px; height: 18px; font-size: 12px"><span style="font-weight: 600">${name}</span><span style="color: #b4b4b4">{{ ${nameKey} }}</span><span style="color: #8c8c8c; font-variant-numeric: tabular-nums">{{ ${posKey} }}</span><span style="margin-left: auto; color: #8c8c8c">본 화면</span></div>`
const section = `<section style="flex: none; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="미리보기">
<div style="flex: none; height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 14px; border-bottom: 1px solid #2b2b2b">
<span style="font-size: 12px; font-weight: 600; line-height: 32px; border-bottom: 2px solid #ececec">미리보기</span>
<span style="margin-left: auto; display: flex; padding: 2px; border-radius: 5px; background: #121212">
<button type="button" style="height: 22px; padding: 0 10px; border: 0; border-radius: 3px; background: transparent; color: #8c8c8c; font-size: 12px">바로 출력</button>
<button type="button" aria-pressed="true" style="height: 22px; padding: 0 10px; border: 0; border-radius: 3px; background: #333333; color: #ececec; font-size: 12px">대기 후 출력</button>
</span>
</div>
<div style="padding: 14px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: center; gap: 8px; height: 24px; font-size: 12px"><span style="font-weight: 600">대기</span><span style="color: #b4b4b4">{{ cueName }}</span><span style="color: #8c8c8c; font-variant-numeric: tabular-nums">{{ cuePos }}</span><button type="button" onClick="{{ take }}" class="hvc" title="출력 Page Down" style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px 0 8px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 12px"><span class="i i14 i-playf" style="color: #d2343a"></span>출력</button></div>
${frame('#3d8bf0', bokeh + '\n' + text('cueText'))}
${label('#d2343a', '출력 중', 'liveName', 'livePos')}
${frame('#d2343a', `<sc-if value="{{ on.media }}" hint-placeholder-val="{{ true }}">${bokeh}</sc-if>
<sc-if value="{{ on.slide }}" hint-placeholder-val="{{ true }}">${text('liveText')}</sc-if>
<sc-if value="{{ on.prop }}" hint-placeholder-val="{{ true }}"><span style="position: absolute; right: 14px; top: 11px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.72)">LOVELIGHT</span></sc-if>
<sc-if value="{{ on.msg }}" hint-placeholder-val="{{ true }}"><div style="position: absolute; left: 0; right: 0; bottom: 0; height: 24px; display: flex; align-items: center; padding: 0 14px; background: rgba(0, 0, 0, 0.8); color: #fff; font-size: 11px; font-weight: 600">12가 3456 차량 이동 부탁드립니다</div></sc-if>`)}
</div>
</section>`
s = s.slice(0, ps) + section + s.slice(pe)
rep('live: 1, size: 3,', 'live: 1, cue: 2, size: 3,')
rep('const live = st.live;', 'const live = st.live;\nconst cue = st.cue;')
rep("ring: i === live ? '#d2343a' : 'transparent', ringW: i === live ? '3px' : '0',", "ring: i === live ? '#d2343a' : (i === cue ? '#3d8bf0' : 'transparent'), ringW: i === live || i === cue ? '3px' : '0', isCue: i === cue && i !== live,")
rep('go: () => this.commit({ live: i, off: Object.assign({}, off, { slide: false }) })', 'go: () => this.setState({ cue: i })')
rep("undoFg: st.prev ? '#ececec' : '#5c5c5c',", `undoFg: st.prev ? '#ececec' : '#5c5c5c',
cueText: lyrics[seq[cue]], cueName: labels[seq[cue]][0] || String(seq[cue] + 1), cuePos: (cue + 1) + ' / ' + seq.length,
liveName: labels[seq[live]][0] || String(seq[live] + 1), livePos: (live + 1) + ' / ' + seq.length,
take: () => this.setState({ live: cue, cue: cue + 1 < seq.length ? cue + 1 : cue, off: Object.assign({}, off, { slide: false }), prev: { live: live, off: off } }),`)
rep('</style>\n</helmet>', '.i-playf{-webkit-mask-image:url("/_blob/7ff7f54d7e72c5d0a1e12cdd55d0dea9");mask-image:url("/_blob/7ff7f54d7e72c5d0a1e12cdd55d0dea9")}\n</style>\n</helmet>')
fs.writeFileSync(dir + 'CueTake.dc.html', s)
console.log('ok')
