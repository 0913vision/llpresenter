import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {startControlPictures} from '@renderer/platform/controlPictures';
import type {PictureRequest} from '@renderer/platform/pictureCache';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {fixtureMedia, itemMedia} from '@fixtures/core/mediaList';

const messages: PictureRequest[] = [];
const answers: Array<(url: string) => void> = [];
const frames: IdleRequestCallback[] = [];
let resize: (() => void) | undefined;
let stop: (() => void) | undefined;
const dispose = vi.fn();

vi.mock('@renderer/platform/pictureCopies', () => ({
  openPictureCopies: () => ({
    get: (request: PictureRequest) => {
      messages.push(request);
      return new Promise<string>(resolve => answers.push(resolve));
    },
    dispose,
  }),
}));

class MockResizeObserver {
  constructor(listener: () => void) {
    resize = listener;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

async function draw(): Promise<void> {
  await Promise.resolve();
  const scheduled = frames.splice(0);
  for (const frame of scheduled) {
    frame({didTimeout: false, timeRemaining: () => 50});
  }
  await Promise.resolve();
}

function picture(): HTMLImageElement {
  const image = document.createElement('img');
  image.src = 'llp-media://media/photo';
  image.style.objectFit = 'cover';
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 440, 248),
  );
  document.body.append(image);
  return image;
}

async function answer(index: number, url: string): Promise<void> {
  const resolve = answers[index];
  if (resolve === undefined) throw new Error('Missing copy request');
  resolve(url);
  await Promise.resolve();
}

beforeEach(() => {
  messages.length = 0;
  answers.length = 0;
  frames.length = 0;
  dispose.mockClear();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('requestIdleCallback', (frame: IdleRequestCallback) => {
    frames.push(frame);
    return frames.length;
  });
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('control pictures', () => {
  it('uses the image original with the existing thumbnail crop at higher density', async () => {
    const image = picture();
    image.src = `llp-media://thumbnail/${fixtureMedia.warm}`;
    stop = startControlPictures(
      mockLlpApi({media: {get: async () => itemMedia()}}),
    );
    await draw();
    expect(messages[0]).toMatchObject({
      source: `llp-media://media/${fixtureMedia.warm}`,
      thumbnail: true,
    });
    await answer(0, `llp-media://media/${fixtureMedia.warm}`);
    expect(image.srcset).toBe('');
    expect(image.src).toBe(`llp-media://thumbnail/${fixtureMedia.warm}`);
  });

  it('keeps the original source while a copy loads', async () => {
    const first = picture();
    stop = startControlPictures(undefined);
    await draw();
    expect(messages).toHaveLength(1);
    expect(first.srcset).toBe('');
    expect(messages[0]).toMatchObject({width: 448, height: 256, fit: 'cover'});
    await answer(0, 'blob:copy');
    expect(first.srcset).toBe('blob:copy 1x');
    expect(first.src).toBe('llp-media://media/photo');
  });

  it('uses transformed display bounds and requests sharper pixels after zoom', async () => {
    const image = picture();
    stop = startControlPictures(undefined);
    await draw();
    await answer(0, 'blob:small');
    vi.stubGlobal('devicePixelRatio', 1.5);
    resize?.();
    await draw();
    expect(messages[1]).toMatchObject({width: 672, height: 384});
    await answer(1, 'blob:large');
    expect(image.srcset).toBe('blob:large 1x');
  });

  it('ignores a late answer for a replaced source', async () => {
    const image = picture();
    stop = startControlPictures(undefined);
    await draw();
    image.src = 'llp-media://media/replacement';
    await draw();
    await answer(0, 'blob:old');
    expect(image.srcset).toBe('');
    await answer(1, 'blob:new');
    expect(image.srcset).toBe('blob:new 1x');
  });

  it('unloads overrides and stops the worker when the control window closes', async () => {
    const image = picture();
    stop = startControlPictures(undefined);
    await draw();
    await answer(0, 'blob:copy');
    stop();
    stop = undefined;
    expect(image.srcset).toBe('');
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('falls back to the source when an evicted copy cannot load', async () => {
    const image = picture();
    stop = startControlPictures(undefined);
    await draw();
    await answer(0, 'blob:evicted');
    image.dispatchEvent(new Event('error'));
    expect(image.srcset).toBe('');
    expect(image.src).toBe('llp-media://media/photo');
  });
});
