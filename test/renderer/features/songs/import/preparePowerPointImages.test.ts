import {expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {preparePowerPointImages} from '@renderer/features/songs/import/preparePowerPointImages';
import {lendPreviewImage} from '@renderer/rendering/previewMedia';

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
  const result = await preparePowerPointImages(
    api,
    [
      {number: 1, shapes: [], background: 'same'},
      {number: 2, shapes: [], background: 'same'},
    ],
    {active: () => true, progress},
  );
  expect(decorationBatch).toHaveBeenCalledOnce();
  expect(releaseFile).toHaveBeenCalledOnce();
  expect(progress.mock.calls).toEqual([
    [{done: 1, total: 2, phase: 'prepare', percent: 100}],
    [{done: 2, total: 2, phase: 'prepare', percent: 100}],
  ]);
  expect(result?.ids.get('same')).toBe('preview');
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
