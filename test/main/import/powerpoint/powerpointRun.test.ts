import type {EventEmitter} from 'node:events';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  endLeftPowerPoint,
  type PowerPointProcesses,
  type StartedPowerPointStore,
} from '@main/import/powerpoint/powerpointProcess';
import {PowerPointRun, scriptLine} from '@main/import/powerpoint/powerpointRun';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  const children: Array<
    EventEmitter & {
      stdout: EventEmitter & {setEncoding: () => void};
      kill: ReturnType<typeof vi.fn>;
    }
  > = [];
  const spawn = vi.fn(() => {
    const stdout = Object.assign(new EventEmitter(), {setEncoding: vi.fn()});
    const child = Object.assign(new EventEmitter(), {stdout, kill: vi.fn()});
    children.push(child);
    return child;
  });
  return {spawn, children};
});
vi.mock('node:child_process', () => ({spawn: mocks.spawn}));
vi.mock('node:fs', () => ({writeFileSync: vi.fn()}));
afterEach(() => {
  mocks.children.length = 0;
  vi.clearAllMocks();
});

// NOTE(0913vision): A pid no process has, so the run does not wait for it to
// quit before it asks the processes.
const STARTED = 999_999_991;

function store(pid: number | null = null): StartedPowerPointStore & {
  readonly value: () => number | null;
} {
  let current = pid;
  return {
    read: () => current,
    write: next => {
      current = next;
    },
    value: () => current,
  };
}

function processes(state: {alive: boolean; windowed: boolean}) {
  return {
    inspect: vi.fn(() => Promise.resolve(state)),
    end: vi.fn(() => Promise.resolve(true)),
  } satisfies PowerPointProcesses;
}

function run(started: StartedPowerPointStore, owner: PowerPointProcesses) {
  return new PowerPointRun({
    script: 'script',
    cleanupScript: 'cleanup',
    directory: 'temp',
    env: {},
    progress: () => undefined,
    processes: owner,
    started,
  });
}

function child(index = 0) {
  const found = mocks.children[index];
  if (!found) throw new Error(`Missing child ${index}`);
  return found;
}

describe('PowerPointRun', () => {
  it('remembers the PowerPoint its script started, and ends it if it has not quit', async () => {
    const started = store();
    const owner = processes({alive: true, windowed: false});
    {
      await using current = run(started, owner);
      child().stdout.emit('data', `STARTED ${STARTED}\n`);
      expect(started.value()).toBe(STARTED);
      child().emit('close', 0);
      expect(await current.result).toBe('ok');
    }
    expect(owner.end).toHaveBeenCalledWith(STARTED);
    expect(started.value()).toBeNull();
  });

  it('leaves a started PowerPoint with a window: the operator opened something in it', async () => {
    const started = store();
    const owner = processes({alive: true, windowed: true});
    {
      await using current = run(started, owner);
      child().stdout.emit('data', `STARTED ${STARTED}\n`);
      child().emit('close', 1);
      await current.result;
    }
    expect(owner.end).not.toHaveBeenCalled();
    expect(started.value()).toBeNull();
  });

  it('stops a script that still runs when it is left, and frees what it holds', async () => {
    const started = store();
    const owner = processes({alive: false, windowed: false});
    const current = run(started, owner);
    child().stdout.emit('data', `STARTED ${STARTED}\n`);
    const released = current[Symbol.asyncDispose]();
    child().emit('close', 0);
    await released;
    expect(await current.result).toBe('cancelled');
    expect(owner.inspect).toHaveBeenCalledWith(STARTED);
    expect(started.value()).toBeNull();
  });

  it('releases once, however often it is disposed', async () => {
    const owner = processes({alive: true, windowed: false});
    const current = run(store(), owner);
    child().stdout.emit('data', `STARTED ${STARTED}\n`);
    child().emit('close', 0);
    await Promise.all([
      current[Symbol.asyncDispose](),
      current[Symbol.asyncDispose](),
    ]);
    expect(owner.end).toHaveBeenCalledOnce();
  });
});

describe('endLeftPowerPoint', () => {
  it('ends a windowless PowerPoint an earlier run left behind', async () => {
    const started = store(STARTED);
    const owner = processes({alive: true, windowed: false});
    expect(await endLeftPowerPoint(started, owner)).toBe(true);
    expect(owner.end).toHaveBeenCalledWith(STARTED);
    expect(started.value()).toBeNull();
  });

  it('leaves one with a window, and forgets one that is gone', async () => {
    const windowed = processes({alive: true, windowed: true});
    const kept = store(STARTED);
    expect(await endLeftPowerPoint(kept, windowed)).toBe(false);
    expect(windowed.end).not.toHaveBeenCalled();
    expect(kept.value()).toBeNull();
    const gone = processes({alive: false, windowed: false});
    expect(await endLeftPowerPoint(store(STARTED), gone)).toBe(false);
    expect(gone.end).not.toHaveBeenCalled();
  });
});

it('reads the started PowerPoint from the script', () => {
  expect(scriptLine('STARTED 4120')).toEqual({kind: 'started', pid: 4120});
  expect(scriptLine('STARTED x')).toBeNull();
});
