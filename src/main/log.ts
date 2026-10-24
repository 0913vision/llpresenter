import {appendFile, mkdir, rename, stat} from 'node:fs/promises';
import {join} from 'node:path';

const DEFAULT_NAME = 'main';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_KEEP = 3;
const DEFAULT_MAX_PENDING_LINES = 1000;

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
  /** The most lines waiting for the disk. More lines are dropped and counted. */
  readonly maxPendingLines?: number;
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

interface Entry {
  readonly time: string;
  readonly level: Level;
  readonly text: string;
  readonly repeats: number;
}

function formatEntry({time, level, text, repeats}: Entry): string {
  const count = repeats > 1 ? ` (repeated ${repeats} times)` : '';
  return `${time} ${level.toUpperCase()} ${text}${count}
`;
}

function droppedEntry(dropped: number): Entry {
  return {
    time: new Date().toISOString(),
    level: 'warn',
    text: `${dropped} log lines dropped because too many were waiting`,
    repeats: 1,
  };
}

/** A logger that writes to a file, with what it hasn't written yet. */
export interface FileLogger extends Logger {
  /** Lines waiting for the disk, at most `maxPendingLines`. */
  readonly pendingLines: number;
}

type FileLoggerSettings = Required<LoggerOptions>;

class RotatingFileLogger implements FileLogger {
  private readonly file: string;
  private size: number | null = null;
  private pending: Entry[] = [];
  private dropped = 0;
  private writing: Promise<void> | null = null;

  constructor(
    private readonly dir: string,
    private readonly settings: FileLoggerSettings,
  ) {
    this.file = join(dir, `${settings.name}.log`);
  }

  get pendingLines(): number {
    return this.pending.length;
  }

  info(message: string, detail?: unknown): void {
    this.log('info', message, detail);
  }

  warn(message: string, detail?: unknown): void {
    this.log('warn', message, detail);
  }

  error(message: string, detail?: unknown): void {
    this.log('error', message, detail);
  }

  async flush(): Promise<void> {
    while (this.writing !== null) await this.writing;
  }

  private log(level: Level, message: string, detail: unknown): void {
    const added = this.enqueueUnlessMerged(
      level,
      `${message}${describeDetail(detail)}`,
    );
    if (added !== null && this.settings.echo) {
      const print = level === 'error' ? console.error : console.log;
      print(formatEntry(added).trimEnd());
    }
    this.scheduleDrain();
  }

  private enqueueUnlessMerged(level: Level, text: string): Entry | null {
    const last = this.pending.at(-1);
    if (last?.level === level && last.text === text) {
      this.pending[this.pending.length - 1] = {
        ...last,
        repeats: last.repeats + 1,
      };
      return null;
    }
    if (this.pending.length >= this.settings.maxPendingLines) {
      this.dropped += 1;
      return null;
    }
    const entry = {time: new Date().toISOString(), level, text, repeats: 1};
    this.pending.push(entry);
    return entry;
  }

  private hasWork(): boolean {
    return this.pending.length > 0 || this.dropped > 0;
  }

  private scheduleDrain(): void {
    if (this.writing !== null) return;
    this.writing = this.drain().finally(() => {
      this.writing = null;
      if (this.hasWork()) this.scheduleDrain();
    });
  }

  private async drain(): Promise<void> {
    while (this.hasWork()) {
      await this.writeNextBatch().catch((error: unknown) => {
        console.error('could not write the log', error);
      });
    }
  }

  private takeBatch(): string[] {
    const entries =
      this.dropped > 0
        ? [...this.pending, droppedEntry(this.dropped)]
        : this.pending;
    this.pending = [];
    this.dropped = 0;
    return entries.map(formatEntry);
  }

  private async writeNextBatch(): Promise<void> {
    // NOTE(0913vision): The batch is taken after the first await, so a burst
    // of lines logged in one go lands in a single batch.
    let used = await this.currentSize();
    let chunk = '';
    for (const line of this.takeBatch()) {
      const bytes = Buffer.byteLength(line);
      if (used > 0 && used + bytes > this.settings.maxBytes) {
        await this.append(chunk);
        chunk = '';
        await this.rotate();
        used = 0;
      }
      chunk += line;
      used += bytes;
    }
    await this.append(chunk);
  }

  private async append(text: string): Promise<void> {
    if (text.length === 0) return;
    await appendFile(this.file, text);
    this.size = (this.size ?? 0) + Buffer.byteLength(text);
  }

  private async currentSize(): Promise<number> {
    if (this.size === null) {
      await mkdir(this.dir, {recursive: true});
      this.size = await stat(this.file).then(
        info => info.size,
        () => 0,
      );
    }
    return this.size;
  }

  private rotated(index: number): string {
    return join(this.dir, `${this.settings.name}.${index}.log`);
  }

  private async rotate(): Promise<void> {
    for (let index = this.settings.keep - 1; index >= 1; index -= 1) {
      await rename(this.rotated(index), this.rotated(index + 1)).catch(
        () => undefined,
      );
    }
    await rename(this.file, this.rotated(1)).catch(() => undefined);
    this.size = 0;
  }
}

/**
 * Creates a rotating file logger. Lines wait in a capped queue and go to the
 * disk in batches. A line identical to the one before it in the queue is
 * merged into it with a count, and lines beyond the cap are dropped and
 * counted in a line of their own. A failed write never throws or stops later
 * lines.
 */
export function createLogger(
  dir: string,
  options: LoggerOptions = {},
): FileLogger {
  return new RotatingFileLogger(dir, {
    name: options.name ?? DEFAULT_NAME,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    keep: options.keep ?? DEFAULT_KEEP,
    echo: options.echo ?? false,
    maxPendingLines: options.maxPendingLines ?? DEFAULT_MAX_PENDING_LINES,
  });
}

/**
 * Waits for the logger to write what it holds, but no longer than the limit,
 * so a stuck disk can't hold up quitting.
 *
 * @returns Whether everything was written in time.
 */
export async function flushWithin(
  logger: Logger,
  limitMs: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => {
    timer = setTimeout(() => resolve(false), limitMs);
  });
  try {
    return await Promise.race([logger.flush().then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
