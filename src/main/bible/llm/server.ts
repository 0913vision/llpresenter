import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import type {BibleAiState} from '@core/schema/bibleAi';
import {parseLlmHealth} from '@core/schema/llmResponse';
import {fetchJson} from './http';

export const MODEL_NAME = 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf';
const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_INTERVAL_MS = 500;
const HEALTH_REQUEST_MS = 2_000;

function pathsAt(home: string) {
  return {
    home,
    exePath: join(home, 'llama', 'llama-server.exe'),
    modelPath: join(home, 'models', MODEL_NAME),
  };
}

/** Prefers LoveLight's complete installation, then Copible's installation. */
export function resolvePaths(home = process.env['LLP_LLM_HOME']) {
  if (home) return pathsAt(home);
  const local = process.env['LOCALAPPDATA'] ?? process.env['HOME'] ?? '.';
  const preferred = pathsAt(join(local, 'LoveLight', 'llm'));
  if (existsSync(preferred.exePath) && existsSync(preferred.modelPath)) {
    return preferred;
  }
  const copible = pathsAt(join(local, 'copible', 'llm'));
  return existsSync(copible.exePath) && existsSync(copible.modelPath)
    ? copible
    : preferred;
}

function serverArgs(modelPath: string, port: number): string[] {
  return [
    '-m',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '-ngl',
    '99',
    '--no-mmap',
    '-c',
    '2048',
    '-b',
    '512',
    '-ub',
    '64',
    '-t',
    '1',
    '-tb',
    '1',
    '--parallel',
    '1',
    '--cache-type-k',
    'q8_0',
    '--cache-type-v',
    'q8_0',
    '--no-webui',
  ];
}

async function probe(endpoint: string, signal: AbortSignal, timeoutMs: number) {
  try {
    const body = await fetchJson({
      url: `${endpoint}/health`,
      init: {},
      timeoutMs,
      signal,
    });
    const parsed = parseLlmHealth(body);
    return parsed.ok && parsed.value.status === 'ok';
  } catch {
    return false;
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, {once: true});
    if (signal.aborted) finish();
  });
}

/** Starts without blocking the app and kills only a child this instance owns. */
export class LlmServer {
  readonly paths: ReturnType<typeof resolvePaths>;
  readonly endpoint: string;
  private readonly port: number;
  private readonly onStatusChange: (state: BibleAiState) => void;
  private state: BibleAiState = {
    status: 'stopped',
    available: false,
    reason: '',
  };
  private child: ChildProcess | null = null;
  private readonly lifetime = new AbortController();
  private starting: Promise<BibleAiState> | null = null;

  constructor({
    home,
    port = 8080,
    onStatusChange = () => undefined,
  }: {
    readonly home?: string;
    readonly port?: number;
    readonly onStatusChange?: (state: BibleAiState) => void;
  } = {}) {
    this.paths = resolvePaths(home);
    this.port = port;
    this.endpoint = `http://127.0.0.1:${port}`;
    this.onStatusChange = onStatusChange;
  }

  getState(): BibleAiState {
    return {...this.state};
  }

  private setStatus(status: BibleAiState['status'], reason = ''): void {
    this.state = {status, available: status === 'ready', reason};
    this.onStatusChange(this.getState());
  }

  start(): Promise<BibleAiState> {
    this.starting ??= this.startInBackground();
    return this.starting;
  }

  private async startInBackground(): Promise<BibleAiState> {
    const signal = this.lifetime.signal;
    try {
      const existing = await probe(this.endpoint, signal, HEALTH_REQUEST_MS);
      signal.throwIfAborted();
      if (existing) {
        this.setStatus('ready');
        return this.getState();
      }
      const missing = [
        !existsSync(this.paths.exePath) ? 'llama-server.exe' : '',
        !existsSync(this.paths.modelPath) ? MODEL_NAME : '',
      ].filter(Boolean);
      if (missing.length > 0) {
        this.setStatus('missing', `Missing ${missing.join(', ')}`);
        return this.getState();
      }
      this.setStatus('starting');
      const child = spawn(
        this.paths.exePath,
        serverArgs(this.paths.modelPath, this.port),
        {
          cwd: dirname(this.paths.exePath),
          windowsHide: true,
          stdio: 'ignore',
        },
      );
      this.child = child;
      child.once('error', error => {
        if (!signal.aborted) this.setStatus('failed', error.message);
      });
      child.once('exit', code => {
        if (this.child === child) this.child = null;
        if (!signal.aborted) {
          this.setStatus('failed', `Server exited (code ${code})`);
        }
      });
      const deadline = Date.now() + HEALTH_TIMEOUT_MS;
      while (Date.now() < deadline && this.state.status === 'starting') {
        signal.throwIfAborted();
        const healthy = await probe(
          this.endpoint,
          signal,
          Math.min(HEALTH_REQUEST_MS, deadline - Date.now()),
        );
        signal.throwIfAborted();
        if (this.getState().status !== 'starting') break;
        if (healthy) {
          this.setStatus('ready');
          return this.getState();
        }
        await pause(
          Math.min(HEALTH_INTERVAL_MS, Math.max(0, deadline - Date.now())),
          signal,
        );
      }
      if (this.state.status === 'starting') {
        this.setStatus('failed', 'Health check timed out');
      }
    } catch (error: unknown) {
      if (!signal.aborted) {
        this.setStatus(
          'failed',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    return this.getState();
  }

  stop(): void {
    this.lifetime.abort();
    const child = this.child;
    this.child = null;
    this.setStatus('stopped');
    if (child) {
      try {
        child.kill();
      } catch {
        // NOTE(0913vision): A process that already exited needs no shutdown.
      }
    }
  }
}
