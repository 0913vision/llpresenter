const fs = require('fs')
const file = '../llp-design/project/ShowH.dc.html'
let s = fs.readFileSync(file, 'utf8')
const rep = (a, b, n = 1) => {
  const parts = s.split(a)
  if (parts.length - 1 !== n) throw new Error('count ' + (parts.length - 1) + ' for ' + a)
  s = parts.join(b)
}
rep('<header style="flex: none; height: 56px; display: flex; align-items: center; gap: 6px; padding: 0 10px">', '<header style="flex: none; height: 56px; display: flex; align-items: center; gap: 6px; padding: 0 4px">')
rep('<div style="flex: none; height: 34px; display: flex; align-items: center; padding: 0 6px 0 12px; border-bottom: 1px solid #2b2b2b">', '<div style="flex: none; height: 34px; display: flex; align-items: center; padding: 0 8px 0 14px; border-bottom: 1px solid #2b2b2b">', 2)
rep('<div style="padding: 10px 10px 6px">', '<div style="padding: 8px 8px 6px">')
rep('<span style="display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border-radius: 4px; background: #121212; color: #8c8c8c"><span class="i i-book"></span><input id="h-verse" placeholder="요 3:16, 창 1:1-5" style="flex: 1; min-width: 0; height: 30px;', '<span style="display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 6px; border-radius: 4px; background: #121212; color: #8c8c8c"><span class="i i-book"></span><input id="h-verse" placeholder="요 3:16, 창 1:1-5" style="flex: 1; min-width: 0; height: 28px;')
rep('gap: 10px; width: 100%; height: 32px; padding: 0 12px 0 14px;', 'gap: 10px; width: 100%; height: 30px; padding: 0 12px 0 14px;')
rep(`<div style="flex: none; height: 40px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid #2b2b2b">
<span style="font-size: 14px; font-weight: 600">만복의 근원 하나님</span>
<span style="font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums">{{ positionText }}</span>`, `<div style="flex: none; height: 34px; display: flex; align-items: center; padding: 0 8px 0 14px; border-bottom: 1px solid #2b2b2b">
<span style="display: flex; align-items: baseline; gap: 10px"><span style="font-size: 13px; font-weight: 600">만복의 근원 하나님</span><span style="font-size: 12px; color: #8c8c8c; font-variant-numeric: tabular-nums">{{ positionText }}</span></span>`)
rep('<div style="flex: 1; min-height: 0; overflow-y: auto; padding: 16px">', '<div style="flex: 1; min-height: 0; overflow-y: auto; padding: 14px">')
rep('gap: 16px; padding: 0 8px 0 12px; border-bottom: 1px solid #2b2b2b">', 'gap: 16px; padding: 0 8px 0 14px; border-bottom: 1px solid #2b2b2b">')
rep('<div style="flex: 1; min-height: 0; padding: 14px 16px; display: grid;', '<div style="flex: 1; min-height: 0; padding: 14px; display: grid;')
rep('<div style="flex: none; height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid #2b2b2b">', '<div style="flex: none; height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 14px; border-bottom: 1px solid #2b2b2b">')
rep('<div style="padding: 12px; display: flex; flex-direction: column; gap: 10px">', '<div style="padding: 14px; display: flex; flex-direction: column; gap: 10px">')
rep('<button type="button" onClick="{{ c.toggle }}" class="hvc" aria-label="{{ c.aria }}" style="position: relative;', '<button type="button" onClick="{{ c.toggle }}" class="hvc" aria-label="{{ c.aria }}" title="{{ c.aria }}" style="position: relative;')
rep('<span style="position: absolute; right: 5px; top: 4px; font-size: 10px; font-weight: 500; color: #6e6e6e; font-variant-numeric: tabular-nums">{{ c.key }}</span>\n', '')
rep('<button type="button" onClick="{{ undo }}" class="hvc" aria-label="되돌리기 Ctrl Z" style="flex: 0 0 44px;', '<span style="flex: none; width: 1px; height: 32px; margin: 0 4px; background: #2b2b2b"></span>\n<button type="button" onClick="{{ undo }}" class="hvc" aria-label="되돌리기 Ctrl Z" title="되돌리기 Ctrl Z" style="flex: 1;')
rep('<div style="flex: none; height: 34px; display: flex; align-items: stretch; gap: 14px; padding: 0 12px; border-bottom: 1px solid #2b2b2b">', '<div style="flex: none; height: 34px; display: flex; align-items: stretch; gap: 14px; padding: 0 14px; border-bottom: 1px solid #2b2b2b">')
rep('<footer style="flex: none; height: 28px; display: flex; align-items: center; gap: 18px; padding: 0 14px;', '<footer style="flex: none; height: 28px; display: flex; align-items: center; gap: 18px; padding: 0 18px;')
fs.writeFileSync(file, s)
console.log('ok')
