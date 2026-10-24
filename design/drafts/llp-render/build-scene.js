// 설정은 프로프리젠터처럼 앱 전체에 하나만 두고 예배 순서에는 항목만 담는다는 결정에 따라
// 다른 예배에서 가져오기(ServiceImport), 예배 순서 바꾸기 목록(ServiceSwitch), 새 예배(NewService의 창)를 만든다.
// 사용: node build-scene.js  (그 뒤 make-fork-a.js 로 NewService 를 다시 만든다)
const fs = require('fs')

function rep(s, a, b, label) {
  const n = s.split(a).length - 1
  if (n !== 1) throw new Error((label || 'replace') + ': found ' + n + ' times: ' + a.slice(0, 90))
  return s.replace(a, () => b)
}

// ---------- 조각 ----------
const cb = (state) => {
  if (state === 'on') return '<span role="checkbox" aria-checked="true" style="flex: none; width: 16px; height: 16px; border-radius: 3px; background: #2a70dc; display: inline-flex; align-items: center; justify-content: center; color: #fff"><span class="i i12 i-check"></span></span>'
  if (state === 'mix') return '<span role="checkbox" aria-checked="mixed" style="flex: none; width: 16px; height: 16px; border-radius: 3px; background: #2a70dc; display: inline-flex; align-items: center; justify-content: center"><span style="width: 8px; height: 2px; border-radius: 1px; background: #fff"></span></span>'
  if (state === 'off') return '<span role="checkbox" aria-checked="false" style="flex: none; width: 16px; height: 16px; box-sizing: border-box; border-radius: 3px; background: #121212; box-shadow: inset 0 0 0 1px #6e6e6e"></span>'
  return ''
}
const icon = (key, color) => `<span class="i i-${key}" style="flex: none; color: ${color || '#b4b4b4'}"></span>`

// 왼쪽 예배 목록
function sourceList(mode, selectedKey) {
  const opt = (key, name, iconKey, meta) => {
    const sel = key === selectedKey
    return `<button type="button" role="option" aria-selected="${sel}" class="hv" style="flex: none; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 10px; border: 0; border-radius: 5px; background: ${sel ? '#1f4170' : 'transparent'}; color: #ececec; text-align: left">
${icon(iconKey, sel ? '#ececec' : '#b4b4b4')}
<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 13px">${name}</span>
<span style="display: flex; gap: 8px; font-size: 11px; line-height: 14px; color: ${sel ? '#b4c6e0' : '#8c8c8c'}; font-variant-numeric: tabular-nums">${meta.map((m) => `<span>${m}</span>`).join('')}</span>
</span>
</button>`
  }
  const group = (title) => `<p style="margin: 0; padding: 10px 10px 5px; font-size: 11px; line-height: 14px; font-weight: 600; color: #8c8c8c">${title}</p>`
  let h = `<div role="listbox" aria-label="예배" style="flex: 0 0 260px; display: flex; flex-direction: column; padding: 8px; box-sizing: border-box; border-right: 1px solid #2b2b2b">\n`
  if (mode === 'new') h += `<button type="button" class="hv" style="flex: none; display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: #ececec; font-size: 13px; text-align: left"><span class="i i-plus" style="color: #b4b4b4"></span>빈 예배</button>\n`
  h += group('틀') + '\n'
  h += opt('t-sun', '주일 예배', 'layers', ['항목 9개']) + '\n'
  h += opt('t-wed', '수요 예배', 'layers', ['항목 7개']) + '\n'
  h += opt('t-fri', '금요 기도회', 'layers', ['항목 6개']) + '\n'
  h += group('지난 예배') + '\n'
  h += opt('p-1025', '주일 예배', 'cal', ['10월 25일 일요일', '항목 12개']) + '\n'
  h += opt('p-1021', '수요 예배', 'cal', ['10월 21일 수요일', '항목 8개']) + '\n'
  h += opt('p-1018', '주일 예배', 'cal', ['10월 18일 일요일', '항목 11개']) + '\n'
  h += opt('p-1014', '수요 예배', 'cal', ['10월 14일 수요일', '항목 7개']) + '\n'
  if (mode === 'new') h += `<button type="button" class="hv" style="margin-top: auto; flex: none; display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 14px 0 12px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; font-size: 13px; text-align: left"><span class="i i-plus"></span>지금 예배를 틀로 저장</button>\n`
  h += '</div>'
  return h
}

// 가운데: 예배 순서
function orderBox(title, count, rows, allState) {
  const head = `<div style="flex: none; box-sizing: border-box; height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid #2b2b2b">${cb(allState)}<span style="font-size: 12px; font-weight: 600">${title}</span><span style="margin-left: auto; font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums">${count}</span></div>`
  const body = rows.map((r) => {
    if (r.h) return `<li style="display: flex; align-items: center; gap: 10px; height: 30px; margin-top: 4px; padding: 0 14px; font-size: 11px; font-weight: 600; color: #8c8c8c">${cb(r.c)}<span>${r.h}</span></li>`
    if (r.slot) return `<li style="display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 14px">${cb(r.c)}<span style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 24px; padding: 0 6px; box-sizing: border-box; border: 1px dashed #6e6e6e; border-radius: 4px; font-size: 13px; color: #8c8c8c">${icon(r.i, '#8c8c8c')}<span style="flex: 1">${r.t}</span><span style="font-size: 11px">빈 자리</span></span></li>`
    return `<li style="display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 14px; font-size: 13px; color: #ececec">${cb(r.c)}${icon(r.i)}<span style="flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis">${r.t}</span>${r.m ? `<span style="font-size: 11px; color: #8c8c8c">${r.m}</span>` : ''}</li>`
  }).join('\n')
  return `<section aria-label="${title}" style="flex: 1; min-width: 0; display: flex; flex-direction: column; border-radius: 5px; background: #1a1a1a; box-shadow: inset 0 0 0 1px #2b2b2b; overflow: hidden">
${head}
<ol style="margin: 0; padding: 0 0 8px; list-style: none">
${body}
</ol>
</section>`
}

const btn = (label, primary) => primary
  ? `<button type="button" style="height: 30px; padding: 0 14px; border: 0; border-radius: 4px; background: #2a70dc; color: #fff; font-size: 13px; font-weight: 600">${label}</button>`
  : `<button type="button" class="hvc" style="height: 30px; padding: 0 14px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 13px">${label}</button>`

function dialog({ title, width, height, left, middle, extraRow, actions }) {
  return `<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 30px; bottom: 0; background: rgba(0, 0, 0, 0.6)"></div>
<section role="dialog" aria-label="${title}" style="position: absolute; left: 50%; top: calc(50% + 15px); width: ${width}px; height: ${height}px; transform: translate(-50%, -50%); display: flex; flex-direction: column; background: #1f1f1f; border-radius: 8px; box-shadow: 0 0 0 1px #3a3a3a, 0 16px 48px rgba(0, 0, 0, 0.6); overflow: hidden">
<div style="flex: none; box-sizing: border-box; height: 44px; display: flex; align-items: center; padding: 0 8px 0 16px; border-bottom: 1px solid #2b2b2b">
<span style="font-size: 13px; font-weight: 600">${title}</span>
<button type="button" class="hv" aria-label="닫기" style="margin-left: auto; width: 30px; height: 30px; border: 0; border-radius: 4px; background: transparent; color: #b4b4b4; display: inline-flex; align-items: center; justify-content: center"><span class="i i-x"></span></button>
</div>
<div style="flex: 1; min-height: 0; display: flex">
${left}
<div style="flex: 1; min-width: 0; display: flex; gap: 12px; padding: 16px">
${middle}
</div>
</div>
${extraRow || ''}<div style="flex: none; box-sizing: border-box; height: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 0 16px; border-top: 1px solid #2b2b2b">
${actions}
</div>
</section>
`
}

// ---------- 내용 ----------
// 10월 25일 주일 예배
const past = (c) => [
  { h: '예배 전', c: c.h1 }, { i: 'film', t: '예배 전 카운트다운', c: c.a }, { i: 'notice', t: '주일 광고', c: c.b },
  { h: '찬양', c: c.h2 }, { i: 'song', t: '만복의 근원 하나님', m: '주일용', c: c.a }, { i: 'song', t: '주 하나님 지으신 모든 세계', m: '기본', c: c.a }, { i: 'song', t: '내 주를 가까이 하게 함은', m: '짧게', c: c.a },
  { h: '말씀', c: c.h2 }, { i: 'book', t: '요한복음 3:16-18', c: c.a }, { i: 'slides', t: '설교: 하나님의 사랑', c: c.a },
  { h: '봉헌', c: c.h2 }, { i: 'pray', t: '헌금 기도', c: c.a }, { i: 'song', t: '내게 있는 모든 것을', m: '기본', c: c.a },
  { h: '마무리', c: c.h3 }, { i: 'notice', t: '새가족 환영회', c: c.b }, { i: 'song', t: '나 같은 죄인 살리신', m: '기본', c: c.a }, { i: 'slides', t: '축도', c: c.a }
]
// 주일 예배 틀
const template = (c) => [
  { h: '예배 전', c }, { i: 'film', t: '예배 전 카운트다운', c }, { i: 'notice', t: '주일 광고', c },
  { h: '찬양', c }, { slot: true, i: 'song', t: '찬양', c }, { slot: true, i: 'song', t: '찬양', c }, { slot: true, i: 'song', t: '찬양', c },
  { h: '말씀', c }, { slot: true, i: 'book', t: '성경 구절', c }, { slot: true, i: 'slides', t: '설교', c },
  { h: '마무리', c }, { slot: true, i: 'song', t: '찬양', c }, { i: 'slides', t: '축도', c }
]

// 다른 예배에서 가져오기: 고른 항목을 지금 예배 순서 끝에 더한다
const importDialog = dialog({
  title: '다른 예배에서 가져오기', width: 820, height: 700,
  left: sourceList('import', 'p-1025'),
  middle: orderBox('예배 순서', '항목 12개', past({ h1: 'mix', h2: 'off', h3: 'mix', a: 'off', b: 'on' }), 'mix'),
  actions: btn('취소') + '\n' + btn('가져오기', true)
})

// 새 예배: 빈 예배, 틀, 지난 예배 중에서 골라 만든다
const nameRow = `<div style="flex: none; box-sizing: border-box; height: 52px; display: flex; align-items: center; gap: 20px; padding: 0 16px; border-top: 1px solid #2b2b2b">
<span style="display: flex; align-items: center; gap: 10px"><span style="font-size: 12px; color: #b4b4b4">이름</span><span style="width: 220px; display: flex; align-items: center; height: 30px; padding: 0 10px; box-sizing: border-box; border-radius: 4px; background: #121212; box-shadow: inset 0 0 0 1px #3d8bf0; font-size: 13px">주일 예배</span></span>
<span style="display: flex; align-items: center; gap: 10px"><span style="font-size: 12px; color: #b4b4b4">날짜</span><button type="button" class="hvc" style="display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px 0 10px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 13px; font-variant-numeric: tabular-nums"><span class="i i-cal" style="color: #b4b4b4"></span>11월 1일 일요일<span class="i i12 i-down" style="color: #8c8c8c"></span></button></span>
<span style="display: flex; align-items: center; gap: 10px"><span style="font-size: 12px; color: #b4b4b4">시간</span><button type="button" class="hvc" style="display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px 0 10px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 13px; font-variant-numeric: tabular-nums"><span class="i i-clock" style="color: #b4b4b4"></span>오전 11:00<span class="i i12 i-down" style="color: #8c8c8c"></span></button></span>
</div>
`
const newDialog = dialog({
  title: '새 예배', width: 820, height: 700,
  left: sourceList('new', 't-sun'),
  middle: orderBox('예배 순서', '항목 9개', template('on'), 'on'),
  extraRow: nameRow,
  actions: btn('취소') + '\n' + btn('만들기', true)
})

// 예배 순서 바꾸기: 머리글의 이름을 누르면 펼치는 목록 (프로프리젠터의 재생목록 목록에 해당)
const nameButton = '<button type="button" class="hv" aria-haspopup="menu" style="margin-left: 4px; display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 4px 0 6px; border: 0; border-radius: 4px; background: transparent; color: #8c8c8c; font-size: 12px">주일 예배<span class="i i12 i-down"></span></button>'
const menuRow = (lead, name, right) => `<button type="button" role="menuitem" class="hv" style="display: flex; align-items: center; gap: 10px; width: 100%; height: 28px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: #ececec; font-size: 13px; text-align: left"><span style="flex: none; width: 14px; display: inline-flex; color: #b4b4b4">${lead}</span><span style="flex: 1">${name}</span>${right ? `<span style="font-size: 11px; color: #8c8c8c; font-variant-numeric: tabular-nums">${right}</span>` : ''}</button>`
const services = [['주일 예배', '11월 1일', true], ['주일 예배', '10월 25일'], ['수요 예배', '10월 21일'], ['주일 예배', '10월 18일'], ['수요 예배', '10월 14일'], ['주일 예배', '10월 11일'], ['수요 예배', '10월 7일']]
const switchMenu = `<div role="menu" aria-label="예배 순서 목록" style="position: absolute; left: 62px; top: 34px; z-index: 5; width: 300px; padding: 6px; box-sizing: border-box; border-radius: 6px; background: #262626; box-shadow: 0 0 0 1px #3a3a3a, 0 8px 24px rgba(0, 0, 0, 0.5)">
<span style="display: flex; align-items: center; gap: 8px; height: 30px; margin-bottom: 4px; padding: 0 8px; border-radius: 4px; background: #121212; color: #8c8c8c"><span class="i i-search"></span><input placeholder="검색" style="flex: 1; min-width: 0; height: 28px; padding: 0; border: 0; background: transparent; color: #ececec; font-size: 13px"></span>
${services.map(([n, d, cur]) => menuRow(cur ? '<span class="i i14 i-check" style="color: #ececec"></span>' : '', n, d)).join('\n')}
<div style="height: 1px; margin: 4px 2px; background: #3a3a3a"></div>
${menuRow('<span class="i i14 i-plus"></span>', '새 예배')}
${menuRow('<span class="i i14 i-download"></span>', '다른 예배에서 가져오기')}
${menuRow('<span class="i i14 i-layers"></span>', '지금 예배를 틀로 저장')}
</div>
`

// ---------- 보드 ----------
const prep = fs.readFileSync('src/PrepService.html', 'utf8')
const leftEnd = '</div>\n\n<section style="flex: 1; min-width: 0; display: flex; flex-direction: column; background: #1c1c1c; border-radius: 5px; overflow: hidden" aria-label="예배 순서 항목">'
function prepBase(title) {
  let s = prep
  s = rep(s, '@@HEAD:예배 순서 항목@@', '@@HEAD:' + title + '@@')
  s = rep(s, '<div style="width: 1920px; height: 1080px; display: flex; flex-direction: column;', '<div style="position: relative; width: 1920px; height: 1080px; display: flex; flex-direction: column;')
  return s
}
{
  let s = prepBase('다른 예배에서 가져오기')
  s = rep(s, '\n</div>\n</x-dc>', '\n' + importDialog + '</div>\n</x-dc>')
  fs.writeFileSync('src/ServiceImport.html', s)
  console.log('wrote src/ServiceImport.html')
}
{
  let s = prepBase('예배 순서 바꾸기')
  s = rep(s, '<div style="flex: 0 0 280px; display: flex; flex-direction: column; gap: 4px">', '<div style="position: relative; flex: 0 0 280px; display: flex; flex-direction: column; gap: 4px">')
  s = rep(s, nameButton, nameButton.replace('background: transparent; color: #8c8c8c', 'background: #333333; color: #ececec'))
  s = rep(s, leftEnd, switchMenu + leftEnd)
  fs.writeFileSync('src/ServiceSwitch.html', s)
  console.log('wrote src/ServiceSwitch.html')
}

// 새 예배 창 조각은 make-fork-a.js 가 준비 화면 위에 얹는다.
fs.writeFileSync('parts/_newservice-dialog.html', newDialog)
fs.writeFileSync('parts/_newservice-data.js', 'const newService = {};\n')
console.log('wrote parts/_newservice-dialog.html')
