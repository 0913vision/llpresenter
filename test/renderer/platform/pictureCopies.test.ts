import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {openPictureCopies} from '@renderer/platform/pictureCopies';
import type {
  PictureCacheOptions,
  PictureRequest,
} from '@renderer/platform/pictureCache';

const mockOptions: {value?: PictureCacheOptions} = vi.hoisted(() => ({}));
vi.mock('@renderer/platform/pictureCache', () => ({
  PictureCache: class MockPictureCache {
    constructor(readonly options: PictureCacheOptions) {
      mockOptions.value = options;
    }
  },
}));

const workers: MockWorker[] = [];
class MockWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
}

const request: PictureRequest = {
  source: 'llp-media://media/photo',
  width: 448,
  height: 256,
  fit: 'cover',
};
const revoke = vi.fn();

function options(): PictureCacheOptions {
  openPictureCopies();
  if (mockOptions.value === undefined) throw new Error('Missing cache options');
  return mockOptions.value;
}

function answer(): MockWorker {
  const worker = workers.at(-1);
  if (worker === undefined) throw new Error('Missing decoder');
  worker.onmessage?.(
    new MessageEvent('message', {
      data: {
        id: 1,
        picture: {blob: new Blob(['png']), width: 448, height: 140},
      },
    }),
  );
  return worker;
}

beforeEach(() => {
  vi.useFakeTimers();
  workers.length = 0;
  revoke.mockClear();
  vi.stubGlobal('Worker', MockWorker);
  vi.stubGlobal(
    'URL',
    class MockURL extends URL {
      static override createObjectURL = vi.fn(() => 'blob:copy');
      static override revokeObjectURL = revoke;
    },
  );
});

afterEach(() => {
  mockOptions.value?.stop?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('preview decoder lifetime', () => {
  it('closes an idle decoder while keeping the small copy alive', async () => {
    const cache = options();
    expect(workers).toHaveLength(0);
    const pending = cache.make(request);
    const worker = answer();
    const copy = await pending;
    expect(copy).toMatchObject({url: 'blob:copy', bytes: 448 * 140 * 4 + 3});
    await vi.advanceTimersByTimeAsync(1000);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    cache.release(copy.url);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:copy');
  });

  it('settles active decoding when the control window closes', async () => {
    const cache = options();
    const pending = cache.make(request);
    const result = expect(pending).rejects.toThrow('Could not decode');
    cache.stop?.();
    await result;
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
  });
});
