// assets.tsv(아티팩트 자산 id, sha256)와 같은 해시의 로컬 파일을 찾아 blob/<id>로 복사한다.
// 사용: node collect.js <검색 폴더>...
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const here = __dirname
const want = new Map()
for (const line of fs.readFileSync(path.join(here, 'assets.tsv'), 'utf8').split('\n')) {
  const [id, sha] = line.trim().split(' ')
  if (id) want.set(sha, id)
}

const exts = new Set(['.svg', '.jpg', '.png', '.woff2'])
function walk(dir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'blob') walk(p) }
    else if (exts.has(path.extname(e.name))) {
      const raw = fs.readFileSync(p)
      // 업로드된 SVG는 <path .../>가 <path ...></path>로 바뀌어 있다.
      const variants = [raw]
      if (path.extname(e.name) === '.svg') variants.push(Buffer.from(raw.toString().replace(/<([a-zA-Z]+)([^<>]*?)\/>/g, '<$1$2></$1>')))
      for (const buf of variants) {
        const sha = crypto.createHash('sha256').update(buf).digest('hex')
        const id = want.get(sha)
        if (id) { fs.writeFileSync(path.join(here, 'blob', id), buf); want.delete(sha) }
      }
    }
  }
}
for (const dir of process.argv.slice(2)) walk(dir)
console.log('missing', [...want.values()].join(' '))
