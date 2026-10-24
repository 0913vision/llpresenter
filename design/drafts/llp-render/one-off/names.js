const fs = require('fs'), path = require('path'), crypto = require('crypto')
const want = new Map()
for (const line of fs.readFileSync('assets.tsv', 'utf8').split('\n')) { const [id, sha] = line.trim().split(' '); if (id) want.set(sha, id) }
const out = {}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.svg')) {
      const raw = fs.readFileSync(p).toString()
      for (const t of [raw, raw.replace(/<([a-zA-Z]+)([^<>]*?)\/>/g, '<$1$2></$1>')]) {
        const id = want.get(crypto.createHash('sha256').update(t).digest('hex'))
        if (id) out[id] = path.basename(path.dirname(p)) + "/" + e.name
      }
    }
  }
}
walk('../llp-design/icons'); walk('../icons/node_modules/@phosphor-icons')
for (const [id, n] of Object.entries(out)) console.log(id, n)
