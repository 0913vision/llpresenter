import {afterEach, expect, it, vi} from 'vitest';
import {BackgroundLayerView} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';

afterEach(() => vi.useRealTimers());

function setup() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const view = new BackgroundLayerView(parent, {
    mode: 'preview',
    mediaUrl: id => `https://thumbnail.test/${id}.jpg`,
    onError,
  });
  const pictures = [...parent.querySelectorAll('img')];
  const first = pictures[0];
  const second = pictures[1];
  if (first === undefined || second === undefined) {
    throw Error('Missing stills');
  }
  return {parent, view, onError, first, second};
}

it('creates no video, retains a same-media still, and updates its element fit', () => {
  const create = vi.spyOn(document, 'createElement');
  const {parent, view, second} = setup();
  view.show({startedAt: 0, mediaId: 'video', loop: true});
  expect(view.ready()).toBe(false);
  expect(second.src).toBe('https://thumbnail.test/video.jpg');
  second.dispatchEvent(new Event('load'));
  expect(view.ready()).toBe(true);
  view.show({
    startedAt: 0,
    mediaId: 'video',
    loop: false,
    properties: {speed: 2, volume: 100, audio: true, fit: 'fit'},
  });
  expect(second.style.objectFit).toBe('contain');
  expect(view.ready()).toBe(true);
  expect(parent.querySelector('video, audio')).toBeNull();
  expect(
    create.mock.calls.some(([tag]) => tag === 'video' || tag === 'audio'),
  ).toBe(false);
  view.dispose();
});

it('keeps the old still until the incoming one loads and releases it after the dissolve', () => {
  vi.useFakeTimers();
  const {view, first, second} = setup();
  view.show({startedAt: 0, mediaId: 'first', loop: true}, false);
  second.dispatchEvent(new Event('load'));
  view.show({startedAt: 0, mediaId: 'second', loop: true});
  expect(second.classList.contains(classes.shown)).toBe(true);
  expect(first.classList.contains(classes.shown)).toBe(false);
  first.dispatchEvent(new Event('load'));
  expect(first.style.zIndex).toBe('1');
  expect(second.style.zIndex).toBe('0');
  vi.runAllTimers();
  expect(second.hasAttribute('src')).toBe(false);
  expect(first.classList.contains(classes.shown)).toBe(true);
  view.dispose();
});

it('cancels superseded loads and bounds images, snapshots, and disposal timers', () => {
  vi.useFakeTimers();
  const {parent, view, first, second} = setup();
  view.show({startedAt: 0, mediaId: 'first', loop: true}, false);
  second.dispatchEvent(new Event('load'));
  for (let at = 0; at < 100; at++) {
    view.show({startedAt: 0, mediaId: `video-${at}`, loop: true});
  }
  expect(first.src).toBe('https://thumbnail.test/video-99.jpg');
  first.dispatchEvent(new Event('load'));
  const next = document.createElement('div');
  view.moveTo(next);
  view.moveTo(parent);
  view.moveTo(next);
  expect(parent.querySelectorAll('[data-media-snapshot]')).toHaveLength(1);
  expect(next.querySelectorAll('img')).toHaveLength(3);
  view.dispose();
  vi.runAllTimers();
  expect(next.querySelector('video')).toBeNull();
  expect(first.hasAttribute('src')).toBe(false);
  expect(second.hasAttribute('src')).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('reports a missing thumbnail once to its new owner without trying to play the file', () => {
  const {parent, view, first, second, onError} = setup();
  const nextError = vi.fn();
  view.setOnError(nextError);
  view.show({startedAt: 0, mediaId: 'missing', loop: true});
  second.dispatchEvent(new Event('error'));
  second.dispatchEvent(new Event('error'));
  expect(view.ready()).toBe(true);
  expect(onError).not.toHaveBeenCalled();
  expect(nextError).toHaveBeenCalledOnce();
  expect(parent.querySelector('video')).toBeNull();
  view.show({startedAt: 0, mediaId: 'next', loop: true}, false);
  second.dispatchEvent(new Event('load'));
  view.show(null);
  expect(first.hasAttribute('src')).toBe(false);
  expect(second.hasAttribute('src')).toBe(false);
  view.dispose();
});

it('ignores metadata resolutions after a preview is cleared or disposed', async () => {
  const resolvers: Array<(url: string) => void> = [];
  const parent = document.createElement('div');
  const onError = vi.fn();
  const view = new BackgroundLayerView(parent, {
    mode: 'preview',
    mediaUrl: id => `https://media.test/${id}`,
    previewMedia: {
      url: () => new Promise<string>(resolve => resolvers.push(resolve)),
      remaining: () => undefined,
    },
    onError,
  });
  view.show({mediaId: 'first', startedAt: 1000, loop: true});
  view.show(null);
  resolvers[0]?.('https://thumbnail.test/first.jpg');
  await Promise.resolve();
  expect(parent.querySelector('img[src]')).toBeNull();
  view.show({mediaId: 'second', startedAt: 1000, loop: true});
  view.dispose();
  resolvers[1]?.('https://thumbnail.test/second.jpg');
  await Promise.resolve();
  expect(parent.childElementCount).toBe(0);
  expect(onError).not.toHaveBeenCalled();
});
