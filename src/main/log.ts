// 회전하는 로그 파일. 쓰기는 하나씩 차례로 하고, 기록이 실패해도 앱을 멈추지 않는다.
// 로그 라이브러리를 고르면 이 감싸개 뒤로 옮긴다(docs/TECH.md).

import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface Logger {
  info(message: string, detail?: unknown): void
  warn(message: string, detail?: unknown): void
  error(message: string, detail?: unknown): void
  /** 지금까지 받은 기록을 모두 쓸 때까지 기다린다(종료 전, 시험). */
  flush(): Promise<void>
}

export interface LoggerOptions {
  readonly name?: string
  /** 파일 하나의 최대 크기. 넘으면 다음 줄을 쓰기 전에 돌린다. */
  readonly maxBytes?: number
  /** 지난 파일을 몇 개까지 남길지. */
  readonly keep?: number
  readonly echo?: boolean
}

type Level = 'info' | 'warn' | 'error'

function describe(detail: unknown): string {
  if (detail === undefined) return ''
  if (detail instanceof Error) return ` ${detail.stack ?? `${detail.name}: ${detail.message}`}`
  try {
    return ` ${JSON.stringify(detail)}`
  } catch {
    return ` ${String(detail)}`
  }
}

export function createLogger(dir: string, options: LoggerOptions = {}): Logger {
  const name = options.name ?? 'main'
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024
  const keep = options.keep ?? 3
  const file = join(dir, `${name}.log`)
  const older = (index: number): string => join(dir, `${name}.${index}.log`)

  let size: number | null = null
  let chain: Promise<void> = Promise.resolve()

  async function rotate(): Promise<void> {
    for (let index = keep - 1; index >= 1; index -= 1) {
      await rename(older(index), older(index + 1)).catch(() => undefined)
    }
    await rename(file, older(1)).catch(() => undefined)
    size = 0
  }

  async function writeLine(line: string): Promise<void> {
    if (size === null) {
      await mkdir(dir, { recursive: true })
      size = await stat(file).then((info) => info.size, () => 0)
    }
    const bytes = Buffer.byteLength(line)
    if (size > 0 && size + bytes > maxBytes) await rotate()
    await appendFile(file, line)
    size += bytes
  }

  function log(level: Level, message: string, detail: unknown): void {
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${describe(detail)}\n`
    if (options.echo === true) {
      if (level === 'error') console.error(line.trimEnd())
      else console.log(line.trimEnd())
    }
    // 앞의 쓰기가 실패해도 다음 줄은 계속 쓴다.
    chain = chain.then(() => writeLine(line)).catch(() => undefined)
  }

  return {
    info: (message, detail) => log('info', message, detail),
    warn: (message, detail) => log('warn', message, detail),
    error: (message, detail) => log('error', message, detail),
    flush: () => chain,
  }
}
