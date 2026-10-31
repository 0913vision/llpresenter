// NOTE(0913vision): Generates project/tokens.css from the token source.
const fs = require('fs')
const j = JSON.parse(fs.readFileSync(__dirname + '/project/tokens.json', 'utf8'))
const title = 'LoveLight Design System'
const first = j.color.themes[0].id
const val = (v) => (typeof v === 'string' ? v : v[first])
const ref = (v) => v.replace(/^\{([^}]+)\}$/, 'var(--$1)')
const lines = [`/* ${title}, generated from tokens.json */`]
lines.push(`:root, [data-theme="${first}"] {`)
for (const t of j.color.tokens) lines.push(`  --${t.name}: ${ref(val(t.value))};`)
for (const t of j.shadow.tokens) lines.push(`  --${t.name}: ${val(t.value)};`)
lines.push('}')
lines.push(':root {')
for (const fam of ['spacing', 'radius', 'size', 'zIndex', 'motion']) for (const t of j[fam].tokens) lines.push(`  --${t.name}: ${t.value};`)
for (const [k, v] of Object.entries(j.type.families)) lines.push(`  --font-${k}: ${v};`)
for (const g of j.type.groups) for (const s of g.styles) lines.push(`  --type-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${s.family || g.family});`)
lines.push('}')
for (const g of j.type.groups) for (const s of g.styles) lines.push(`.${s.name} { font-family: var(--font-${s.family || g.family}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight}; }`)
for (const f of j.type.fonts) lines.push(`@font-face { font-family: "${f.family}"; src: url("${f.file}") format("woff2"); font-weight: ${f.weight}; font-display: swap; }`)
fs.writeFileSync(__dirname + '/project/tokens.css', lines.join('\n') + '\n')
console.log('tokens.css', lines.length, 'lines')
