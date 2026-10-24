import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from './log'

describe('createLogger', () => {
  let dir = ''

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'llp-log-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('줄마다 시각, 수준, 내용을 쓰고 오류는 스택을 붙인다', async () => {
    const log = createLogger(join(dir, 'logs'))
    log.info('시작', { version: '0.2.0' })
    log.error('실패', new Error('모니터를 찾을 수 없습니다'))
    await log.flush()
    const text = await readFile(join(dir, 'logs', 'main.log'), 'utf8')
    const lines = text.trim().split('\n')
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.* INFO 시작 \{"version":"0.2.0"\}$/)
    expect(text).toContain('ERROR 실패 Error: 모니터를 찾을 수 없습니다')
  })

  it('크기를 넘으면 돌리고 지난 파일은 정한 수만 남긴다', async () => {
    const log = createLogger(dir, { maxBytes: 200, keep: 2 })
    for (let i = 0; i < 40; i += 1) log.info(`줄 ${i}`, { padding: 'x'.repeat(40) })
    await log.flush()
    const files = (await readdir(dir)).sort()
    expect(files).toEqual(['main.1.log', 'main.2.log', 'main.log'])
    const current = await readFile(join(dir, 'main.log'), 'utf8')
    expect(Buffer.byteLength(current)).toBeLessThanOrEqual(200)
    expect(current).toContain('줄 39')
  })

  it('순환 참조처럼 글로 바꿀 수 없는 값도 기록을 멈추지 않는다', async () => {
    const log = createLogger(dir)
    const loop: { self?: unknown } = {}
    loop.self = loop
    log.warn('이상한 값', loop)
    log.info('다음 줄')
    await log.flush()
    const text = await readFile(join(dir, 'main.log'), 'utf8')
    expect(text).toContain('WARN 이상한 값 [object Object]')
    expect(text).toContain('INFO 다음 줄')
  })
})
