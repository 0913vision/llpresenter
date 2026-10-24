const s = require('fs').readFileSync(process.argv[2], 'utf8')
const t = s.slice(s.indexOf('renderVals'))
const strs = [...new Set([...t.matchAll(/'([^']{2,})'/g)].map((m) => m[1]).filter((x) => /[가-힣]/.test(x)))]
console.log(strs.join(' | '))
