import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {expect, it, vi} from 'vitest';

it('mirrors changed presenter frames at most ten times per second', () => {
  const port = new EventEmitter();
  const postMessage = vi.fn<(value: {type: string}) => void>();
  Object.assign(port, {postMessage});
  const ticks: Array<() => void> = [];
  let now = 0;
  let pending = false;
  const requestMirror = vi.fn(() => {
    pending = true;
    return true;
  });
  let copying = false;
  const presenter = {
    visible: true,
    busy: false,
    frame: vi.fn(),
    copied: () => {
      const done = copying;
      copying = false;
      return done;
    },
    takeEnded: () => null,
    keepPlaced: () => null,
    submit: vi.fn(() => {
      copying = true;
    }),
    startMirror: vi.fn(),
    stopMirror: vi.fn(),
    requestMirror,
    takeMirror: vi.fn(() => {
      if (!pending) return null;
      pending = false;
      return new Uint8Array(640 * 360 * 4);
    }),
  };
  const source = readFileSync(
    new URL(
      '../../../../src/main/outputs/presenter/presenter-utility.cjs',
      import.meta.url,
    ),
    'utf8',
  );
  const requireMock = (name: string): unknown => {
    if (name === 'node:process') return {parentPort: port};
    if (name === 'node:perf_hooks') return {performance: {now: () => now}};
    if (name === 'node:timers') {
      return {
        setImmediate: (callback: () => void) => ticks.push(callback),
        setTimeout: (callback: () => void) => ticks.push(callback),
      };
    }
    if (name === './d3dPresenter.cjs') {
      return {createPresenter: () => presenter};
    }
    throw new Error(`Unexpected import ${name}`);
  };
  runInNewContext(source, {require: requireMock});
  const message = (data: object): void => {
    port.emit('message', {data});
  };
  const tick = (): void => {
    const next = ticks.shift();
    if (!next) throw new Error('Missing presenter tick');
    next();
  };
  message({type: 'open', bounds: {x: 0, y: 0, width: 1920, height: 1080}});
  message({type: 'mirror', enabled: true});
  tick();
  tick();
  expect(requestMirror).toHaveBeenCalledTimes(1);
  expect(
    postMessage.mock.calls.filter(([value]) => value.type === 'mirror-frame'),
  ).toHaveLength(1);
  message({type: 'mirror-ack'});
  now = 1000;
  tick();
  expect(requestMirror).toHaveBeenCalledTimes(1);
  expect(presenter.takeMirror).toHaveBeenCalledTimes(1);
  message({type: 'frame', pid: 1, handle: 'fixture'});
  tick();
  tick();
  expect(requestMirror).toHaveBeenCalledTimes(2);
  message({type: 'mirror-ack'});
  message({type: 'frame', pid: 1, handle: 'fixture'});
  now = 1050;
  tick();
  expect(requestMirror).toHaveBeenCalledTimes(2);
  now = 1100;
  tick();
  expect(requestMirror).toHaveBeenCalledTimes(3);
});

function runUtility(presenter: object, onCreate: () => void = () => undefined) {
  const port = new EventEmitter();
  const postMessage =
    vi.fn<(value: {type: string; message?: string; id?: number}) => void>();
  Object.assign(port, {postMessage});
  const ticks: Array<() => void> = [];
  const source = readFileSync(
    new URL(
      '../../../../src/main/outputs/presenter/presenter-utility.cjs',
      import.meta.url,
    ),
    'utf8',
  );
  runInNewContext(source, {
    require: (name: string): unknown => {
      if (name === 'node:process') return {parentPort: port};
      if (name === 'node:perf_hooks') return {performance: {now: () => 0}};
      if (name === 'node:timers') {
        return {
          setImmediate: (callback: () => void) => ticks.push(callback),
          setTimeout: (callback: () => void) => ticks.push(callback),
        };
      }
      if (name === './d3dPresenter.cjs') {
        return {
          createPresenter: () => {
            onCreate();
            return presenter;
          },
        };
      }
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const message = (data: object): void => {
    port.emit('message', {data});
  };
  message({
    type: 'open',
    bounds: {x: 1920, y: 0, width: 1920, height: 1080},
  });
  return {postMessage, ticks, message};
}

it('opens its window again when it is gone, and gives up after three times a minute', () => {
  let made = 0;
  const presenter = {
    visible: true,
    busy: false,
    frame: vi.fn(),
    copied: () => false,
    takeEnded: () => null,
    keepPlaced: () => ({lost: true}),
    close: vi.fn(),
    startMirror: vi.fn(),
    stopMirror: vi.fn(),
  };
  const {postMessage, ticks} = runUtility(presenter, () => {
    made += 1;
  });
  for (let i = 0; i < 3; i++) ticks.shift()?.();

  expect(made).toBe(4);
  const types = postMessage.mock.calls.map(([value]) => value.type);
  expect(types.filter(type => type === 'reopened')).toHaveLength(3);
  expect(types.filter(type => type === 'ready')).toHaveLength(1);

  ticks.shift()?.();
  const last = postMessage.mock.lastCall?.[0];
  expect(last?.type).toBe('error');
  expect(last?.message).toContain('keeps going away');
});

it('tells the main process when it put a moved or hidden window back', () => {
  const port = new EventEmitter();
  const postMessage = vi.fn<(value: {type: string; was?: unknown}) => void>();
  Object.assign(port, {postMessage});
  const ticks: Array<() => void> = [];
  const was = {left: 0, top: 0, right: 1920, bottom: 1080, shown: false};
  const keepPlaced = vi
    .fn()
    .mockReturnValueOnce({lost: false, was})
    .mockReturnValue(null);
  const presenter = {
    visible: true,
    busy: false,
    frame: vi.fn(),
    copied: () => false,
    takeEnded: () => null,
    keepPlaced,
    submit: vi.fn(),
    startMirror: vi.fn(),
    stopMirror: vi.fn(),
  };
  const source = readFileSync(
    new URL(
      '../../../../src/main/outputs/presenter/presenter-utility.cjs',
      import.meta.url,
    ),
    'utf8',
  );
  runInNewContext(source, {
    require: (name: string): unknown => {
      if (name === 'node:process') return {parentPort: port};
      if (name === 'node:perf_hooks') return {performance: {now: () => 0}};
      if (name === 'node:timers') {
        return {
          setImmediate: (callback: () => void) => ticks.push(callback),
          setTimeout: (callback: () => void) => ticks.push(callback),
        };
      }
      if (name === './d3dPresenter.cjs') {
        return {createPresenter: () => presenter};
      }
      throw new Error(`Unexpected import ${name}`);
    },
  });
  port.emit('message', {
    data: {type: 'open', bounds: {x: 1920, y: 0, width: 1920, height: 1080}},
  });
  ticks.shift()?.();
  ticks.shift()?.();

  const replaced = postMessage.mock.calls.filter(
    ([value]) => value.type === 'replaced',
  );
  expect(replaced).toEqual([[{type: 'replaced', was}]]);
  expect(keepPlaced).toHaveBeenCalledTimes(2);
});

it('gives back the frame it was copying when its window goes away, and keeps one frame waiting while it copies', () => {
  let lost = false;
  const presenter = {
    visible: true,
    busy: false,
    frame: vi.fn(),
    copied: () => false,
    takeEnded: () => null,
    keepPlaced: () => (lost ? {lost: true} : null),
    submit: vi.fn(),
    close: vi.fn(),
    startMirror: vi.fn(),
    stopMirror: vi.fn(),
  };
  const {postMessage, ticks, message} = runUtility(presenter);
  message({type: 'frame', pid: 1, handle: 'a', id: 1});
  message({type: 'frame', pid: 1, handle: 'b', id: 2});
  message({type: 'frame', pid: 1, handle: 'c', id: 3});
  expect(presenter.submit).toHaveBeenCalledOnce();
  expect(postMessage).toHaveBeenCalledWith({type: 'copied', id: 2});

  lost = true;
  ticks.shift()?.();

  const copied = postMessage.mock.calls
    .map(([value]) => value)
    .filter(value => value.type === 'copied');
  expect(copied).toEqual([
    {type: 'copied', id: 2},
    {type: 'copied', id: 1},
    {type: 'copied', id: 3},
  ]);
  expect(postMessage).toHaveBeenLastCalledWith({type: 'reopened'});
});

it('moves its window when Windows shifts the monitor and the size stays, and makes it anew only for a new size or refresh (church Nov 26 17:10)', () => {
  let made = 0;
  const moveTo = vi.fn(
    (next: {width: number; height: number}) =>
      next.width === 1920 && next.height === 1080,
  );
  const presenter = {
    visible: true,
    busy: false,
    frame: vi.fn(),
    copied: () => false,
    takeEnded: () => null,
    keepPlaced: () => null,
    close: vi.fn(),
    moveTo,
    startMirror: vi.fn(),
    stopMirror: vi.fn(),
  };
  const {postMessage, message} = runUtility(presenter, () => {
    made += 1;
  });
  expect(made).toBe(1);
  message({
    type: 'open',
    bounds: {x: 1922, y: 0, width: 1920, height: 1080},
  });
  expect(moveTo).toHaveBeenLastCalledWith(
    expect.objectContaining({x: 1922, width: 1920}),
  );
  expect(made).toBe(1);
  expect(presenter.close).not.toHaveBeenCalled();
  expect(
    postMessage.mock.calls.filter(([value]) => value.type === 'ready'),
  ).toHaveLength(2);
  message({
    type: 'open',
    bounds: {x: 1922, y: 0, width: 1280, height: 720},
  });
  expect(made).toBe(2);
  message({
    type: 'open',
    hz: 30,
    bounds: {x: 1922, y: 0, width: 1280, height: 720},
  });
  expect(made).toBe(3);
});
