import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {expect, it, vi} from 'vitest';

it('never reads back the presenter when a preview is requested', () => {
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
  const presenter = {
    visible: true,
    busy: false,
    frame: vi.fn(),
    copied: () => false,
    submit: vi.fn(),
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
      '../../../src/main/presenter/presenter-utility.cjs',
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
  expect(requestMirror).not.toHaveBeenCalled();
  expect(
    postMessage.mock.calls.filter(([value]) => value.type === 'mirror-frame'),
  ).toHaveLength(0);
  message({type: 'mirror-ack'});
  now = 1000;
  tick();
  expect(requestMirror).not.toHaveBeenCalled();
  expect(presenter.takeMirror).not.toHaveBeenCalled();
  message({type: 'frame', pid: 1, handle: 'fixture'});
  tick();
  tick();
  expect(requestMirror).not.toHaveBeenCalled();
  message({type: 'mirror-ack'});
  message({type: 'frame', pid: 1, handle: 'fixture'});
  now = 1050;
  tick();
  expect(requestMirror).not.toHaveBeenCalled();
  now = 1100;
  tick();
  expect(requestMirror).not.toHaveBeenCalled();
});
