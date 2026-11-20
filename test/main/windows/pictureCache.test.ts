import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {PictureCache} from '@main/windows/pictureCache';
import type {PictureRequest} from '@core/schema/picture';

const painter = vi.hoisted(() => ({paint: vi.fn(), dispose: vi.fn()}));
vi.mock('@main/windows/painter', () => ({
  PicturePainter: class {
    paint = painter.paint;
    dispose = painter.dispose;
  },
}));

it('deduplicates simultaneous windows and reuses a disk picture after restart', async () => {
  const root = resolve(process.cwd(), '.llp');
  await mkdir(root, {recursive: true});
  const folder = await mkdtemp(join(root, 'picture-cache-test-'));
  if (dirname(folder) !== root) throw new Error('Invalid test cache path');
  const image = Buffer.from([0xff, 0xd8, 42, 0xff, 0xd9]);
  painter.paint.mockReset().mockResolvedValue(image);
  const screen = createScreenId('00000000-0000-4000-8000-000000000001');
  const request: PictureRequest = {
    inputs: 'font-and-media',
    spec: {
      layers: {
        ...emptyLayers(),
        slide: {itemId: 'song', position: 0, label: null, lines: ['Words']},
      },
      appearance: {
        screen: {id: screen, kind: 'audience'},
        theme: {
          themeId: createThemeId('00000000-0000-4000-8000-000000000002'),
          revision: 0,
          missing: [],
          item: null,
          sourceScreenId: screen,
          layout: {mode: {kind: 'own'}, elements: []},
          emptyColor: '#000000',
        },
        background: '#000000',
        checker: false,
      },
    },
  };
  try {
    const cache = new PictureCache(folder);
    const [first, second] = await Promise.all([
      cache.get(request),
      cache.get(request),
    ]);
    expect(first).toEqual(image);
    expect(second).toEqual(image);
    expect(painter.paint).toHaveBeenCalledTimes(1);
    await cache.dispose();
    const reopened = new PictureCache(folder);
    expect(await reopened.get(request)).toEqual(image);
    expect(painter.paint).toHaveBeenCalledTimes(1);
    const changed = {
      ...request,
      spec: {
        ...request.spec,
        layers: {
          ...request.spec.layers,
          slide: {
            ...request.spec.layers.slide,
            itemId: 'song',
            position: 0,
            label: null,
            lines: ['Changed'],
          },
        },
      },
    };
    await reopened.get(changed);
    expect(painter.paint).toHaveBeenCalledTimes(2);
    const edited = {...changed, inputs: 'editor'};
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0,
    ]);
    expect(reopened.reserve(edited, 1)).toBe(true);
    expect(reopened.reserve(edited, 2)).toBe(false);
    const waiting = reopened.get(edited);
    reopened.release(edited, 2);
    reopened.remember(edited, png, 2);
    expect(painter.paint).toHaveBeenCalledTimes(2);
    reopened.remember(edited, png, 1);
    expect(await waiting).toEqual(png);
    expect(painter.paint).toHaveBeenCalledTimes(2);
    const cancelled = {...edited, inputs: 'cancelled'};
    expect(reopened.reserve(cancelled, 1)).toBe(true);
    const fallback = reopened.get(cancelled);
    reopened.release(cancelled, 1);
    expect(await fallback).toEqual(image);
    expect(painter.paint).toHaveBeenCalledTimes(3);
    vi.useFakeTimers();
    try {
      const abandoned = {...edited, inputs: 'abandoned'};
      expect(reopened.reserve(abandoned, 1)).toBe(true);
      const recovered = reopened.get(abandoned);
      await vi.advanceTimersByTimeAsync(5000);
      expect(await recovered).toEqual(image);
      expect(painter.paint).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
    const unused = {...edited, inputs: 'unused'};
    expect(reopened.reserve(unused, 1)).toBe(true);
    reopened.release(unused, 1);
    expect(painter.paint).toHaveBeenCalledTimes(4);
    expect(await reopened.get(unused)).toEqual(image);
    expect(painter.paint).toHaveBeenCalledTimes(5);
    const temporary = {
      ...edited,
      inputs: 'temporary',
      spec: {
        ...edited.spec,
        layers: {
          ...edited.spec.layers,
          media: {mediaId: 'preview:hash', loop: false, startedAt: 0},
        },
      },
    };
    expect(reopened.reserve(temporary, 1)).toBe(true);
    const importWaiter = reopened.peek(temporary);
    reopened.release(temporary, 1);
    expect(await importWaiter).toBeNull();
    expect(painter.paint).toHaveBeenCalledTimes(5);
    await reopened.dispose();
    const disk = new PictureCache(folder);
    expect(await disk.peek(edited)).toEqual(png);
    expect(await disk.peek({...edited, inputs: 'not-on-disk'})).toBeNull();
    expect(painter.paint).toHaveBeenCalledTimes(5);
    const otherScreen: PictureRequest = {
      ...request,
      spec: {
        ...request.spec,
        appearance: {
          ...request.spec.appearance,
          screen: {
            ...request.spec.appearance.screen,
            id: createScreenId('00000000-0000-4000-8000-000000000003'),
          },
        },
      },
    };
    expect(await disk.get(otherScreen)).toEqual(image);
    expect(painter.paint).toHaveBeenCalledTimes(6);
    const failed = {...request, inputs: 'failed-draw'};
    painter.paint.mockRejectedValueOnce(new Error('draw failed'));
    await expect(disk.get(failed)).rejects.toThrow('draw failed');
    expect(await disk.peek(failed)).toBeNull();
    expect(await disk.get(failed)).toEqual(image);
    expect(painter.paint).toHaveBeenCalledTimes(8);
    await disk.dispose();
  } finally {
    await rm(folder, {recursive: true, force: true});
  }
});
