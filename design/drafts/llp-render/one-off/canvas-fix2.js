const fs = require('fs')
const f = '../llp-design/project/canvas.json'
const c = JSON.parse(fs.readFileSync(f, 'utf8'))
c.boards['Macros.dc.html'].w = 1780
c.boards['Macros.dc.html'].h = 580
c.boards['Outputs.dc.html'].x = 5300
c.notes.rowDetail.maxW = 5860
c.boards['MacrosV1.dc.html'] = { x: 9360, y: 3900, w: 1504, h: 658, title: '매크로 1차 (편집 창)', page: 'backup' }
c.order.splice(c.order.indexOf('OutputsV1.dc.html') + 1, 0, 'MacrosV1.dc.html')
fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n')
console.log('ok', Object.keys(c.boards).length)
