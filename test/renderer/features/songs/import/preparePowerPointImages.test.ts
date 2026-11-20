import {expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  preparePowerPointImages,
  type PowerPointPreviewProgress,
} from '@renderer/features/songs/import/preparePowerPointImages';
import {lendPreviewImage} from '@renderer/rendering/previewMedia';
import type {PowerPointImageExportProgress} from '@core/schema/powerpointImport';

vi.mock('@renderer/rendering/previewMedia', () => ({
  lendPreviewImage: vi.fn(),
}));
vi.mock('@renderer/features/songs/import/thumbnailPowerPointImage', () => ({
  thumbnailPowerPointImage: vi.fn(async (blob: Blob) => blob),
}));
vi.mock('@renderer/features/songs/import/composePowerPointBackground', () => ({
  composePowerPointBackground: vi.fn(async () => ({
    mime: 'image/png',
    bytes: new Uint8Array([1]),
  })),
}));

it('publishes a completed thumbnail before the batch export finishes', async () => {
  const release = vi.fn();
  vi.mocked(lendPreviewImage).mockReturnValue({id: 'preview', release});
  let progress: (value: PowerPointImageExportProgress) => void = () => undefined;
  let finish: (value: Array<{index: number; path: string}>) => void = () =>
    undefined;
  let shown: () => void = () => undefined;
  const visible = new Promise<void>(resolve => {
    shown = resolve;
  });
  const api = mockLlpApi({
    powerpoint: {
      subscribeImageProgress: listener => {
        progress = listener;
        return () => undefined;
      },
      decorationBatch: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
      previewImage: async () => ({
        mime: 'image/png',
        bytes: new Uint8Array([1]),
      }),
      release: async () => true,
    },
  });
  const work = preparePowerPointImages(
    api,
    [{number: 1, shapes: [], background: 'a'}],
    {
      active: () => true,
      progress: () => undefined,
      onImage: () => shown(),
    },
  );
  progress({done: 1, total: 1, index: 0, path: 'first.png'});
  await visible;
  finish([{index: 0, path: 'first.png'}]);
  const result = await work;
  expect(result?.ids.get('a')).toBe('preview');
  result?.release();
});

it('prepares distinct backgrounds once and reports every slide', async () => {
  const release = vi.fn();
  vi.mocked(lendPreviewImage).mockReturnValue({id: 'preview', release});
  const decorationBatch = vi.fn(async () => [
    {index: 0, path: 'temporary.png'},
  ]);
  const releaseFile = vi.fn(async () => true);
  const api = mockLlpApi({
    powerpoint: {
      decorationBatch,
      previewImage: async () => ({
        mime: 'image/png',
        bytes: new Uint8Array([1]),
      }),
      release: releaseFile,
    },
  });
  const progress = vi.fn();
  const onImage = vi.fn();
  const result = await preparePowerPointImages(
    api,
    [
      {number: 1, shapes: [], background: 'same'},
      {number: 2, shapes: [], background: 'same'},
    ],
    {active: () => true, progress, onImage},
  );
  expect(decorationBatch).toHaveBeenCalledOnce();
  expect(releaseFile).toHaveBeenCalledOnce();
  expect(progress.mock.calls).toEqual([
    [{done: 2, total: 2, phase: 'prepare', percent: 100}],
    [{done: 2, total: 2, phase: 'prepare', percent: 100}],
  ]);
  expect(result?.ids.get('same')).toBe('preview');
  expect(onImage).toHaveBeenCalledExactlyOnceWith('same', 'preview');
  result?.release();
  expect(release).toHaveBeenCalledOnce();
});

it('releases prepared images when cancelled', async () => {
  const release = vi.fn();
  vi.mocked(lendPreviewImage).mockReturnValue({id: 'preview', release});
  const api = mockLlpApi({
    powerpoint: {
      decorationBatch: async () => [
        {index: 0, path: 'first.png'},
        {index: 1, path: 'second.png'},
      ],
      previewImage: async () => ({
        mime: 'image/png',
        bytes: new Uint8Array([1]),
      }),
    },
  });
  let active = true;
  const result = await preparePowerPointImages(
    api,
    [
      {number: 1, shapes: [], background: 'first'},
      {number: 2, shapes: [], background: 'second'},
    ],
    {
      active: () => active,
      progress: () => {
        active = false;
      },
    },
  );
  expect(result).toBeNull();
  expect(release).toHaveBeenCalledOnce();
});

it('releases earlier images and files if the preview memory limit is reached', async () => {
  const release = vi.fn();
  vi.mocked(lendPreviewImage)
    .mockReturnValueOnce({id: 'first', release})
    .mockReturnValueOnce(null);
  const releaseFile = vi.fn(async () => true);
  const api = mockLlpApi({
    powerpoint: {
      decorationBatch: async () => [
        {index: 0, path: 'first.png'},
        {index: 1, path: 'second.png'},
      ],
      previewImage: async () => ({
        mime: 'image/png',
        bytes: new Uint8Array([1]),
      }),
      release: releaseFile,
    },
  });
  await expect(
    preparePowerPointImages(
      api,
      [
        {number: 1, shapes: [], background: 'first'},
        {number: 2, shapes: [], background: 'second'},
      ],
      {active: () => true, progress: () => undefined},
    ),
  ).rejects.toThrow('PowerPoint preview image limit reached');
  expect(release).toHaveBeenCalledOnce();
  expect(releaseFile).toHaveBeenCalledTimes(2);
});

it('keeps successful exports and falls back only for missing slides, with monotonic slide counts', async () => {
  vi.mocked(lendPreviewImage).mockReturnValue({
    id: 'preview',
    release: vi.fn(),
  });
  const layers = vi.fn(async () => ({
    key: 'a'.repeat(64),
    layers: [],
    pictures: [],
    skipped: 0,
  }));
  const previewImage = vi.fn(async () => ({
    mime: 'image/png' as const,
    bytes: new Uint8Array([1]),
  }));
  const api = mockLlpApi({
    powerpoint: {
      decorationBatch: async () => [{index: 2, path: 'success.png'}],
      previewImage,
      layers,
      release: async () => true,
    },
  });
  const progress = vi.fn((value: PowerPointPreviewProgress) => value.done);
  const result = await preparePowerPointImages(
    api,
    [
      {number: 1, shapes: [], background: null},
      {number: 2, shapes: [], background: 'missing'},
      {number: 3, shapes: [], background: 'success'},
      {number: 4, shapes: [], background: 'missing'},
    ],
    {active: () => true, progress},
  );
  expect(layers).toHaveBeenCalledTimes(1);
  expect(layers).toHaveBeenCalledWith({index: 1});
  expect(previewImage).toHaveBeenCalledWith({path: 'success.png'});
  expect(progress.mock.calls.map(([value]) => value.done)).toEqual([3, 4, 4]);
  result?.release();
});
