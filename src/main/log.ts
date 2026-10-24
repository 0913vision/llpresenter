import {appendFile, mkdir, rename, stat} from 'node:fs/promises';
import {join} from 'node:path';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_KEEP = 3;

export interface Logger {
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
  /** Resolves once every line logged so far is written (before quitting, in tests). */
  flush(): Promise<void>;
}

export interface LoggerOptions {
  readonly name?: string;
  /** The size at which the file rotates before the next line. */
  readonly maxBytes?: number;
  /** How many rotated files to keep. */
  readonly keep?: number;
  /** Also print each line to the console. */
  readonly echo?: boolean;
}

type Level = 'info' | 'warn' | 'error';

const UNSERIALIZABLE_DETAIL = '[detail that JSON cannot represent]';

function describeDetail(detail: unknown): string {
  if (detail === undefined) return '';
  if (detail instanceof Error) {
    return ` ${detail.stack ?? `${detail.name}: ${detail.message}`}`;
  }
  if (typeof detail === 'bigint') return ` ${detail.toString()}n`;
  try {
    return ` ${JSON.stringify(detail)}`;
  } catch {
    return ` ${UNSERIALIZABLE_DETAIL}`;
  }
}

function formatLine(level: Level, message: string, detail: unknown): string {
  const time = new Date().toISOString();
  return `${time} ${level.toUpperCase()} ${message}${describeDetail(detail)}\n`;
}

/**
 * Creates a rotating file logger. Lines are written one at a time, and a
 * failed write never throws or stops later lines.
 */
export function createLogger(dir: string, options: LoggerOptions = {}): Logger {
  const name = options.name ?? 'main';
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const keep = options.keep ?? DEFAULT_KEEP;
  const file = join(dir, `${name}.log`);
  const rotated = (index: number): string => join(dir, `${name}.${index}.log`);

  let size: number | null = null;
  let pending: Promise<void> = Promise.resolve();

  async function rotate(): Promise<void> {
    for (let index = keep - 1; index >= 1; index -= 1) {
      await rename(rotated(index), rotated(index + 1)).catch(() => undefined);
    }
    await rename(file, rotated(1)).catch(() => undefined);
    size = 0;
  }

  async function currentSize(): Promise<number> {
    if (size === null) {
      await mkdir(dir, {recursive: true});
      size = await stat(file).then(
        info => info.size,
        () => 0,
      );
    }
    return size;
  }

  async function writeLine(line: string): Promise<void> {
    const bytes = Buffer.byteLength(line);
    const used = await currentSize();
    if (used > 0 && used + bytes > maxBytes) await rotate();
    await appendFile(file, line);
    size = (size ?? 0) + bytes;
  }

  function log(level: Level, message: string, detail: unknown): void {
    const line = formatLine(level, message, detail);
    if (options.echo === true) {
      const print = level === 'error' ? console.error : console.log;
      print(line.trimEnd());
    }
    pending = pending.then(() => writeLine(line)).catch(() => undefined);
  }

  return {
    info: (message, detail) => log('info', message, detail),
    warn: (message, detail) => log('warn', message, detail),
    error: (message, detail) => log('error', message, detail),
    flush: () => pending,
  };
}
