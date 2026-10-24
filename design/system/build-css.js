// css/*.css 조각을 이름 순서대로 이어 project/components/bundle.css를 만든다.
const fs = require('fs')
const dir = __dirname + '/css'
const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort()
const out = parts.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(dir + '/' + f, 'utf8').trim() + '\n').join('\n')
if (/<\/style/i.test(out)) throw new Error('bundle.css must not contain </style')
fs.mkdirSync(__dirname + '/project/components', { recursive: true })
fs.writeFileSync(__dirname + '/project/components/bundle.css', out)
console.log('bundle.css from', parts.length, 'parts,', out.length, 'bytes')
