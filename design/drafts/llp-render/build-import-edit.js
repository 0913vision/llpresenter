// 가져온 곡을 저장하기 전에 편집하는 화면(ImportEdit)과, 저장할 때 같은 곡이 있으면 묻는 창(ImportSave)을 만든다.
// 준비 화면의 라이브러리 곡 편집기(src/Reflow.html)를 바탕으로 한다.
const fs = require('fs')
let s = fs.readFileSync('src/Reflow.html', 'utf8')
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('not unique: ' + a.slice(0, 70)); s = s.replace(a, () => b) }
const lines = s.split('\n')

rep('@@HEAD:준비 화면@@', '@@HEAD:가져온 곡 편집@@')

// 머리글: 제목 칸(같은 제목이면 빨간 테두리), 가져온 곡 표시, 기본 배경, 버리기와 저장
const hStart = s.indexOf('<span style="display: flex; align-items: baseline; gap: 10px"><span style="font-size: 13px; font-weight: 600">만복의 근원 하나님</span>')
const hEnd = s.indexOf('<span style="margin-right: 8px; font-size: 12px; color: #8c8c8c">기본 배경</span>')
if (hStart < 0 || hEnd < 0) throw new Error('header markers')
s = s.slice(0, hStart) + `<span title="라이브러리에 같은 제목의 곡이 있습니다" style="width: 280px; display: flex; align-items: center; height: 26px; padding: 0 8px; box-sizing: border-box; border-radius: 4px; background: #121212; box-shadow: inset 0 0 0 1px #d2343a; font-size: 13px; font-weight: 600">만복의 근원 하나님</span>
<span style="margin-left: auto; margin-right: 8px; font-size: 12px; color: #8c8c8c">기본 배경</span>` + s.slice(hEnd + '<span style="margin-right: 8px; font-size: 12px; color: #8c8c8c">기본 배경</span>'.length)

// 배경 칩 뒤에 버리기와 저장
const chipEnd = s.indexOf('</button>', s.indexOf('따뜻한 빛<span class="i i12 i-down"')) + '</button>'.length
s = s.slice(0, chipEnd) + `
<span style="width: 1px; height: 16px; margin: 0 10px; background: #2b2b2b"></span>
<button type="button" class="hvc" style="height: 26px; padding: 0 10px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 12px">버리기</button>
<button type="button" style="margin-left: 8px; height: 26px; padding: 0 10px; border: 0; border-radius: 4px; background: #2a70dc; color: #fff; font-size: 12px; font-weight: 600">저장</button>` + s.slice(chipEnd)

// 이름표 선택 창은 이 화면에서는 닫힌 상태
const mStart = s.indexOf('<div role="menu" aria-label="이름표"')
const mEnd = s.indexOf('</section>', mStart)
if (mStart < 0) throw new Error('menu')
s = s.slice(0, mStart) + s.slice(mEnd)

// 아직 라이브러리에 없으므로 라이브러리 목록에서 고른 곡이 없다
rep("const sel = l[0] === '만복의 근원 하나님';", 'const sel = false;')
rep("const arrangements = ['기본', '주일용', '짧게']", "const arrangements = ['기본']")
rep('const menuOpen = true;', 'const menuOpen = false;')

fs.writeFileSync('src/ImportEdit.html', s)

// 저장을 누르면 같은 곡이 있을 때만 묻는다
const confirm = `<div style="position: absolute; left: 0; right: 0; top: 30px; bottom: 0; background: rgba(0, 0, 0, 0.6)"></div>
<section role="alertdialog" aria-label="같은 제목의 곡" style="position: absolute; left: 730px; top: calc(50% + 15px); transform: translateY(-50%); width: 460px; padding: 20px 20px 16px; box-sizing: border-box; background: #1f1f1f; border-radius: 8px; box-shadow: 0 0 0 1px #3a3a3a, 0 16px 48px rgba(0, 0, 0, 0.6)">
<div style="display: flex; align-items: flex-start; gap: 14px">
<span style="flex: none; width: 40px; height: 40px; border-radius: 5px; background: #1c1c1c; display: inline-flex; align-items: center; justify-content: center; color: #b4b4b4"><span class="i i24 i-song"></span></span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">
<p style="margin: 0; font-size: 16px; line-height: 22px; font-weight: 600">‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?</p>
<p style="margin: 0; font-size: 12px; line-height: 16px; color: #8c8c8c; font-variant-numeric: tabular-nums">라이브러리 곡 4장, 10월 20일 수정</p>
</div>
</div>
<div style="display: flex; align-items: center; gap: 8px; margin-top: 20px">
<button type="button" class="hvc" style="height: 30px; padding: 0 14px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 13px">취소</button>
<button type="button" class="hvc" style="margin-left: auto; height: 30px; padding: 0 14px; border: 0; border-radius: 4px; background: #2a2a2a; color: #ececec; font-size: 13px">새 곡으로 저장</button>
<button type="button" style="height: 30px; padding: 0 14px; border: 0; border-radius: 4px; background: #2a70dc; color: #fff; font-size: 13px; font-weight: 600">덮어쓰기</button>
</div>
</section>
`
const rootEnd = s.lastIndexOf('</div>\n</x-dc>')
if (rootEnd < 0) throw new Error('root end')
let save = s.slice(0, rootEnd) + confirm + s.slice(rootEnd)
save = save.replace('@@HEAD:가져온 곡 편집@@', '@@HEAD:저장할 때 같은 곡이 있으면@@')
// 확인 창이 화면 기준으로 놓이도록 바깥 틀을 기준 위치로 만든다
save = save.replace('<div style="width: 1920px; height: 1080px; display: flex;', '<div style="position: relative; width: 1920px; height: 1080px; display: flex;')
fs.writeFileSync('src/ImportSave.html', save)
console.log('ok')
