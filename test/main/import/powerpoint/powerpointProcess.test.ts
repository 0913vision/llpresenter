import {EventEmitter} from 'node:events';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {
  endLeftPowerPoint,
  fileStartedPowerPoint,
  windowsPowerPointProcesses,
  type PowerPointProcesses,
  type PowerPointProcessState,
  type StartedPowerPointStore,
} from '@main/import/powerpoint/powerpointProcess';

interface FakeChild extends EventEmitter {
  readonly stdout: EventEmitter & {setEncoding: () => void};
  readonly kill: () => void;
}
const spawned = vi.hoisted(() => {
  const children: FakeChild[] = [];
  return {children};
});
vi.mock('node:child_process', async () => {
  const {EventEmitter: Emitter} = await import('node:events');
  return {
    spawn: vi.fn(() => {
      const child = Object.assign(new Emitter(), {
        stdout: Object.assign(new Emitter(), {setEncoding: () => undefined}),
        kill: vi.fn(),
      });
      spawned.children.push(child);
      return child;
    }),
  };
});

afterEach(() => {
  spawned.children.length = 0;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function memoryStore(pid: number | null) {
  let kept = pid;
  const store: StartedPowerPointStore = {
    read: () => kept,
    write: next => {
      kept = next;
    },
  };
  return {store, kept: () => kept};
}

function processes(state: PowerPointProcessState, ends = true) {
  const end = vi.fn(async () => ends);
  const fake: PowerPointProcesses = {inspect: vi.fn(async () => state), end};
  return {fake, end};
}

describe('endLeftPowerPoint', () => {
  it('does nothing when the app started no PowerPoint', async () => {
    const {store} = memoryStore(null);
    const {fake, end} = processes({alive: true, windowed: false});
    expect(await endLeftPowerPoint(store, fake)).toBe(false);
    expect(end).not.toHaveBeenCalled();
  });

  it('forgets a PowerPoint that is gone, and leaves one with a window alone', async () => {
    for (const state of [
      {alive: false, windowed: false},
      {alive: true, windowed: true},
    ]) {
      const {store, kept} = memoryStore(4242);
      const {fake, end} = processes(state);
      expect(await endLeftPowerPoint(store, fake)).toBe(false);
      expect(end).not.toHaveBeenCalled();
      expect(kept()).toBeNull();
    }
  });

  it('ends a windowless PowerPoint left behind, and keeps it remembered when it will not end', async () => {
    const ended = memoryStore(4242);
    const working = processes({alive: true, windowed: false});
    expect(await endLeftPowerPoint(ended.store, working.fake)).toBe(true);
    expect(working.end).toHaveBeenCalledWith(4242);
    expect(ended.kept()).toBeNull();

    const stuck = memoryStore(4242);
    const refusing = processes({alive: true, windowed: false}, false);
    expect(await endLeftPowerPoint(stuck.store, refusing.fake)).toBe(false);
    expect(stuck.kept()).toBe(4242);
  });
});

describe('fileStartedPowerPoint', () => {
  it('keeps the started process id in its file and forgets it', async () => {
    const file = join(await makeTempDir(), 'powerpoint-started.txt');
    const store = fileStartedPowerPoint(file);
    expect(store.read()).toBeNull();
    store.write(1234);
    expect(readFileSync(file, 'utf8')).toBe('1234');
    expect(store.read()).toBe(1234);
    store.write(null);
    expect(store.read()).toBeNull();
  });

  it('reads nothing from a file that holds no process id', async () => {
    const file = join(await makeTempDir(), 'powerpoint-started.txt');
    writeFileSync(file, 'not a pid');
    expect(fileStartedPowerPoint(file).read()).toBeNull();
  });
});

describe('windowsPowerPointProcesses.inspect', () => {
  it('answers gone for an id that can not be a process, without asking Windows', async () => {
    expect(await windowsPowerPointProcesses.inspect(-1)).toEqual({
      alive: false,
      windowed: false,
    });
    expect(spawned.children).toHaveLength(0);
  });

  it('reads whether PowerPoint runs and has a window from what PowerShell prints', async () => {
    const answer = windowsPowerPointProcesses.inspect(4242);
    const child = spawned.children[0];
    child?.stdout.emit('data', 'ALIVE 1\r\n');
    child?.emit('close', 0);
    expect(await answer).toEqual({alive: true, windowed: true});
  });

  it('answers gone and stops PowerShell when it does not answer in time', async () => {
    vi.useFakeTimers();
    const answer = windowsPowerPointProcesses.inspect(4242);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await answer).toEqual({alive: false, windowed: false});
    expect(spawned.children[0]?.kill).toHaveBeenCalled();
  });
});
