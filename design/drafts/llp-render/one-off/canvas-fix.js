const fs = require('fs')
const f = '../llp-design/project/canvas.json'
const c = JSON.parse(fs.readFileSync(f, 'utf8'))
const b = c.boards
b['Main.dc.html'].h = 2700
b['Reflow.dc.html'].title = '준비 화면: 라이브러리 곡'
b['PrepService.dc.html'] = { x: 5360, y: 0, w: 1920, h: 1080, title: '준비 화면: 예배 순서 항목', page: 'v2' }
b['Screens.dc.html'].x = 7360
b['Looks.dc.html'].x = 9360
b['Macros.dc.html'] = { x: 3440, y: 1500, w: 1504, h: 658, title: '매크로', page: 'v2' }
b['Outputs.dc.html'].x = 5024
c.order.splice(c.order.indexOf('Reflow.dc.html') + 1, 0, 'PrepService.dc.html')
c.order.splice(c.order.indexOf('Overlays.dc.html') + 1, 0, 'Macros.dc.html')
c.notes.rowMain.maxW = 9920
c.notes.rowDetail.maxW = 5584
fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n')
console.log(Object.keys(b).length, 'boards')
