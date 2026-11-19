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
    await reopened.dispose();
  } finally {
    await rm(folder, {recursive: true, force: true});
  }
});
