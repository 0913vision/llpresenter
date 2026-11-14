import {afterEach, expect, it, vi} from 'vitest';
import {SnapshotTransition} from '@renderer/output/snapshotTransition';

const imageAnimate = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  'animate',
);
afterEach(() => {
  vi.restoreAllMocks();
  if (imageAnimate === undefined) {
    Reflect.deleteProperty(HTMLImageElement.prototype, 'animate');
  } else {
    Object.defineProperty(HTMLImageElement.prototype, 'animate', imageAnimate);
  }
});

it('holds one still under the incoming surface and removes it when the wipe completes', async () => {
  const host = document.createElement('div');
  const surface = document.createElement('div');
  host.append(surface);
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frame = callback;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  let finish: () => void = () => undefined;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  const animate = vi.fn(() => ({finished, cancel: vi.fn()}));
  Object.defineProperty(surface, 'animate', {value: animate});
  const view = new SnapshotTransition(host, surface);
  expect(await view.prepare('data:image/png;base64,AA==')).toBe(true);
  const still = host.querySelector('img');
  expect(still?.style.zIndex).toBe('2');
  const done = vi.fn();
  view.play({kind: 'wipe', dir: 'left', sec: 1}, () => true, done);
  if (frame === undefined) throw Error('Missing animation frame');
  frame(0);
  expect(still?.style.zIndex).toBe('0');
  expect(still?.style.opacity).toBe('1');
  expect(animate).toHaveBeenCalledOnce();
  finish();
  await finished;
  await Promise.resolve();
  await Promise.resolve();
  expect(host.querySelector('img')).toBeNull();
  expect(done).toHaveBeenCalledOnce();
});

it('discards a snapshot whose decode finishes after cancellation', async () => {
  const host = document.createElement('div');
  const surface = document.createElement('div');
  let finish: () => void = () => undefined;
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  const view = new SnapshotTransition(host, surface);
  const pending = view.prepare('data:image/png;base64,AA==');
  view.clear();
  finish();
  expect(await pending).toBe(false);
  expect(host.querySelector('img')).toBeNull();
});

it('animates two decoded pictures and restores live output only after completion', async () => {
  const host = document.createElement('div');
  const surface = document.createElement('div');
  host.append(surface);
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
  let finish: () => void = () => undefined;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  const animate = vi.fn(() => ({finished, cancel: vi.fn()}));
  Object.defineProperty(HTMLImageElement.prototype, 'animate', {
    value: animate,
    configurable: true,
  });
  const liveAnimate = vi.fn();
  Object.defineProperty(surface, 'animate', {value: liveAnimate});
  const view = new SnapshotTransition(host, surface);
  expect(await view.prepare('data:image/png;base64,AA==')).toBe(true);
  const done = vi.fn();
  expect(
    await view.playPrepared(
      'data:image/png;base64,AQ==',
      {kind: 'wipe', sec: 1},
      done,
    ),
  ).toBe(true);
  expect(host.querySelectorAll('img')).toHaveLength(2);
  expect(surface.style.visibility).toBe('hidden');
  expect(animate).toHaveBeenCalledOnce();
  expect(liveAnimate).not.toHaveBeenCalled();
  finish();
  await finished;
  await Promise.resolve();
  await Promise.resolve();
  expect(host.querySelectorAll('img')).toHaveLength(0);
  expect(surface.style.visibility).toBe('');
  expect(done).toHaveBeenCalledOnce();
});
