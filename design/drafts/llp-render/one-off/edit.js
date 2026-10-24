// 사용: node edit.js <파일> <바꿀 내용 JSON 파일>  (JSON: [[찾을 문자열, 바꿀 문자열], ...])
const fs = require('fs')
const [file, specFile] = process.argv.slice(2)
let s = fs.readFileSync(file, 'utf8')
for (const [a, b] of JSON.parse(fs.readFileSync(specFile, 'utf8'))) {
  const n = s.split(a).length - 1
  if (n !== 1) throw new Error('found ' + n + ' times: ' + a.slice(0, 80))
  s = s.replace(a, () => b)
}
fs.writeFileSync(file, s)
console.log('edited', file)
