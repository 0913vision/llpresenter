import {expect, it} from 'vitest';
import {
  createItemOverlayId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import type {ServiceItemOf} from '@core/schema/service';
import {
  projectedItemOverlays,
  storedSongOverlays,
} from '@core/services/songItemOverlays';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {checkPart} from '@core/schema/fileFormat';
import {itemOverlaysSchema} from '@core/schema/itemOverlays';
import {liveThemeItemSchema} from '@core/schema/liveTheme';

const ids = [1, 2, 3].map(fixtureSlideId);
function fixture(): ServiceItemOf<'song'> {
  const [from, , to] = ids;
  if (from === undefined || to === undefined) {
    throw new Error('Missing fixture IDs');
  }
  return {
    id: createServiceItemId('10000000-0000-4000-8000-000000000001'),
    song: createSongId('20000000-0000-4000-8000-000000000001'),
    slides: ids.map(id => ({id, lines: []})),
    overlays: [
      {
        id: createItemOverlayId('30000000-0000-4000-8000-000000000001'),
        name: 'Invented',
        from,
        to,
        screens: [],
        content: {text: 'Overlay'},
      },
    ],
  };
}

it('stores slide identities and resolves their current positions after a reorder', () => {
  const item = fixture();
  const projected = projectedItemOverlays(item);
  expect(projected).toMatchObject([{from: 1, to: 3}]);
  expect(storedSongOverlays(item, projected)).toEqual(item.overlays);
  expect(
    projectedItemOverlays({...item, slides: [...item.slides].reverse()}),
  ).toEqual(projected);
});

it('leaves missing endpoints inactive without retargeting a surviving slide', () => {
  const item = fixture();
  expect(
    projectedItemOverlays({...item, slides: item.slides.slice(1)}),
  ).toEqual([]);
  expect(
    storedSongOverlays({...item, slides: []}, projectedItemOverlays(item)),
  ).toEqual([]);
  expect(projectedItemOverlays(null)).toEqual([]);
});

it('normalizes overlapping UUID ranges into valid output ranges without changing saved endpoints', () => {
  const base = fixture();
  const overlay = base.overlays?.[0];
  if (overlay === undefined) throw new Error('Missing overlay');
  const item = {
    ...base,
    slides: [1, 2, 3, 4, 5].map(number => ({
      id: fixtureSlideId(number),
      lines: [],
    })),
    overlays: [
      {...overlay, from: fixtureSlideId(2), to: fixtureSlideId(4)},
      {
        ...overlay,
        id: createItemOverlayId('30000000-0000-4000-8000-000000000002'),
        from: fixtureSlideId(1),
        to: fixtureSlideId(3),
      },
      {
        ...overlay,
        id: createItemOverlayId('30000000-0000-4000-8000-000000000003'),
        from: fixtureSlideId(2),
        to: fixtureSlideId(3),
      },
      {
        ...overlay,
        id: createItemOverlayId('30000000-0000-4000-8000-000000000004'),
        from: fixtureSlideId(5),
        to: fixtureSlideId(4),
      },
    ],
  };
  const projected = projectedItemOverlays(item);
  expect(projected.map(({from, to}) => [from, to])).toEqual([
    [4, 4],
    [1, 3],
    [5, 5],
  ]);
  expect(checkPart(itemOverlaysSchema, projected).ok).toBe(true);
  expect(
    checkPart(liveThemeItemSchema, {
      id: item.id,
      kind: 'song',
      source: 'service',
      overlays: projected,
    }).ok,
  ).toBe(true);
  expect(item.overlays[0]?.from).toBe(fixtureSlideId(2));
  expect(item.overlays).toHaveLength(4);
  const reordered = projectedItemOverlays({
    ...item,
    slides: [...item.slides].reverse(),
  });
  expect(checkPart(itemOverlaysSchema, reordered).ok).toBe(true);
});
