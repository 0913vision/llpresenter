import {ChildProcess, spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LlmServer, MODEL_NAME, resolvePaths} from '@main/bible/llm/server';
import {startMockLlm} from '@fixtures/main/llmHttp';

vi.mock('node:fs', () => ({existsSync: vi.fn(() => false)}));
vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawn: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
});
beforeEach(() => {
  vi.mocked(spawn).mockReset();
  vi.mocked(existsSync).mockReset().mockReturnValue(false);
});

function mockChild() {
  const child = new ChildProcess();
  const kill = vi.spyOn(child, 'kill').mockReturnValue(true);
  vi.mocked(spawn).mockReturnValue(child);
  return {child, kill};
}

describe('local LLM server', () => {
  it('prefers LoveLight, then Copible, with an exclusive environment override', () => {
    vi.stubEnv('LOCALAPPDATA', join('C:', 'data'));
    vi.stubEnv('LLP_LLM_HOME', '');
    const light = join('C:', 'data', 'LoveLight', 'llm');
    const copible = join('C:', 'data', 'copible', 'llm');
    vi.mocked(existsSync).mockReturnValue(true);
    expect(resolvePaths().home).toBe(light);
    vi.mocked(existsSync).mockImplementation(path =>
      String(path).startsWith(copible),
    );
    expect(resolvePaths().home).toBe(copible);
    vi.stubEnv('LLP_LLM_HOME', join('C:', 'override'));
    expect(resolvePaths().home).toBe(join('C:', 'override'));
    expect(resolvePaths(join('C:', 'explicit')).home).toBe(
      join('C:', 'explicit'),
    );
  });

  it('reuses a healthy HTTP server even without files and never kills it', async () => {
    const {port} = await startMockLlm((request, response) => {
      expect(request.url).toBe('/health');
      response.end('{"status":"ok"}');
    });
    const server = new LlmServer({home: 'unused', port});
    try {
      expect(await server.start()).toEqual({
        status: 'ready',
        available: true,
        reason: '',
      });
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      server.stop();
    }
    expect(server.getState().status).toBe('stopped');
  });

  it.each(['exe', 'model', 'both'])(
    'reports missing %s files without spawning',
    async missing => {
      vi.mocked(existsSync).mockImplementation(path =>
        missing === 'both'
          ? false
          : missing === 'exe'
            ? String(path).endsWith('.gguf')
            : String(path).endsWith('.exe'),
      );
      const {port} = await startMockLlm((_request, response) => {
        response.statusCode = 503;
        response.end('{}');
      });
      const server = new LlmServer({home: 'unused', port});
      try {
        expect(await server.start()).toMatchObject({
          status: 'missing',
          available: false,
        });
        expect(server.getState().reason).toContain(
          missing === 'model' ? MODEL_NAME : 'llama-server.exe',
        );
        expect(spawn).not.toHaveBeenCalled();
      } finally {
        server.stop();
      }
    },
  );

  it('spawns once with Copible arguments, hides the window and stops its own child', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const {child, kill} = mockChild();
    let healthy = false;
    vi.mocked(spawn).mockImplementation(() => {
      healthy = true;
      return child;
    });
    const {port} = await startMockLlm((_request, response) =>
      response.end(JSON.stringify({status: healthy ? 'ok' : 'loading'})),
    );
    const states: string[] = [];
    const server = new LlmServer({
      home: join('C:', 'data', 'llm'),
      port,
      onStatusChange: state => states.push(state.status),
    });
    try {
      const start = server.start();
      expect(server.start()).toBe(start);
      expect(await start).toMatchObject({status: 'ready', available: true});
      expect(states).toEqual(['starting', 'ready']);
      expect(spawn).toHaveBeenCalledExactlyOnceWith(
        server.paths.exePath,
        [
          '-m',
          server.paths.modelPath,
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
        ],
        {
          cwd: dirname(server.paths.exePath),
          windowsHide: true,
          stdio: 'ignore',
        },
      );
    } finally {
      server.stop();
      server.stop();
    }
    expect(kill).toHaveBeenCalledOnce();
    child.emit('exit', 0);
    expect(server.getState().status).toBe('stopped');
  });

  it('polls every 500 ms and fails at 180 seconds while retaining its child for quit', async () => {
    vi.useFakeTimers();
    vi.mocked(existsSync).mockReturnValue(true);
    const {kill} = mockChild();
    const fetchMock = vi.fn(async () => new Response('{"status":"loading"}'));
    vi.stubGlobal('fetch', fetchMock);
    const server = new LlmServer({home: 'unused'});
    try {
      const start = server.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(499);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(179_500);
      expect(await start).toMatchObject({
        status: 'failed',
        available: false,
        reason: 'Health check timed out',
      });
    } finally {
      server.stop();
    }
    expect(kill).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['throw', 'error', 'exit'])(
    'handles a spawn %s without an uncaught failure',
    async failure => {
      vi.mocked(existsSync).mockReturnValue(true);
      const {child} = mockChild();
      vi.mocked(spawn).mockImplementation(() => {
        if (failure === 'throw') throw new Error('spawn failed');
        queueMicrotask(() =>
          failure === 'error'
            ? child.emit('error', new Error('spawn failed'))
            : child.emit('exit', 1),
        );
        return child;
      });
      const {port} = await startMockLlm((_request, response) =>
        response.end('{"status":"loading"}'),
      );
      const server = new LlmServer({home: 'unused', port});
      try {
        expect(await server.start()).toMatchObject({
          status: 'failed',
          available: false,
        });
      } finally {
        server.stop();
      }
    },
  );

  it('cannot become ready or spawn after quit during the initial probe', async () => {
    let reached: () => void = () => undefined;
    const pending = new Promise<void>(resolve => {
      reached = resolve;
    });
    const {port} = await startMockLlm((_request, response) => {
      reached();
      response.writeHead(200);
      response.write('{');
    });
    const server = new LlmServer({home: 'unused', port});
    const start = server.start();
    await pending;
    server.stop();
    expect(await start).toMatchObject({status: 'stopped', available: false});
    expect(spawn).not.toHaveBeenCalled();
  });

  it('aborts health polling on quit without a later timeout failure', async () => {
    vi.useFakeTimers();
    vi.mocked(existsSync).mockReturnValue(true);
    const {kill} = mockChild();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"loading"}')),
    );
    const server = new LlmServer({home: 'unused'});
    const start = server.start();
    await vi.advanceTimersByTimeAsync(0);
    server.stop();
    expect(await start).toMatchObject({status: 'stopped'});
    expect(kill).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
