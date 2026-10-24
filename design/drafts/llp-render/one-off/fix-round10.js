// 10차 수정: 맞춤 지우기를 다중 레이어 지우기로, 가져오기의 같은 곡 처리를 확인 창으로.
const fs = require('fs')

function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8')
  for (const [a, b, count] of pairs) {
    const n = s.split(a).length - 1
    if (n !== (count || 1)) throw new Error(file + ': expected ' + (count || 1) + ', found ' + n + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(file, s)
  console.log('edited', file)
}

// 1. 이름 바꾸기
edit('src/ClearGroups.html', [
  ['@@HEAD:맞춤 지우기@@', '@@HEAD:다중 레이어 지우기@@'],
  ['맞춤 지우기 설정', '다중 레이어 지우기 설정', 3],
  ['aria-label="맞춤 지우기 추가"', 'aria-label="다중 레이어 지우기 추가"']
])
{
  const f = '../llp-design/project/Main.dc.html'
  let s = fs.readFileSync(f, 'utf8')
  const n = s.split('맞춤 지우기').length - 1
  s = s.split('맞춤 지우기').join('다중 레이어 지우기')
  fs.writeFileSync(f, s)
  console.log('report renamed', n)
}

// 2. 가져오기 창에서는 같은 곡 표시를 빼고, 가져오기를 누를 때만 확인 창을 띄운다
edit('parts-local/_import-text-dialog.html', [
  ['<span style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #b4b4b4"><span style="width: 6px; height: 6px; border-radius: 50%; background: #e3a23b"></span>라이브러리에 있음</span>\n<button type="button" class="hvc" style="display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 8px 0 10px; border: 0; border-radius: 4px; background: #262626; color: #ececec; font-size: 12px">새 곡으로<span class="i i12 i-down" style="color: #8c8c8c"></span></button>\n', '']
])
