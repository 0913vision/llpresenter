import {expect, it, vi} from 'vitest';
import {ServicePicturePreloader} from '@renderer/output/servicePicturePreloader';
import type {ServiceRow, SlideTile} from '@core/presentation/model';

it('discards an old render after the service changes and preloads the new slide', async () => {
  const rows: readonly ServiceRow[] = [
    {kind: 'song', id: 'song', title: 'Song'},
  ];
  const tile: SlideTile = {
    label: null,
    labelColor: 'none',
    lines: ['first'],
    transition: {kind: 'wipe', sec: 1},
  };
  let finish: (picture: string | null) => void = () => undefined;
  const render = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string | null>(resolve => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce('new');
  const preloader = new ServicePicturePreloader(render);
  preloader.refresh(rows, {song: [tile]});
  await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  preloader.refresh(rows, {song: [{...tile, lines: ['changed']}]});
  finish('stale');
  await vi.waitFor(() =>
    expect(preloader.get({itemId: 'song', index: 0})).toBe('new'),
  );
  expect(render).toHaveBeenCalledTimes(2);
  preloader.dispose();
  expect(preloader.get({itemId: 'song', index: 0})).toBeUndefined();
});

it('does not render a cut slide outside the selected transition pairs', async () => {
  const rows: readonly ServiceRow[] = [
    {kind: 'song', id: 'song', title: 'Song'},
  ];
  const tile: SlideTile = {label: null, labelColor: 'none', lines: []};
  const render = vi.fn(async () => 'picture');
  const preloader = new ServicePicturePreloader(render);
  preloader.refresh(rows, {song: [tile]});
  preloader.request({itemId: 'song', index: 0});
  await Promise.resolve();
  expect(render).not.toHaveBeenCalled();
  preloader.dispose();
});
