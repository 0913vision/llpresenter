import {expect, it} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import type {ClearEffect} from '@core/schema/clearFade';
import {createMediaId, createPropId, type PropId} from '@core/schema/ids';
import {ClearFades} from '@renderer/rendering/clearFades';
import {shownText} from '@fixtures/core/liveSlide';

const slide = {itemId: 'item', position: 0, ...shownText('가사')};
const layer = (kind: 'slide' | 'media'): ClearEffect => ({
  target: {kind: 'layer', layer: kind},
  since: 1000,
  durationMs: 500,
});
const A = createPropId('00000000-0000-4000-8000-000000000001');
const B = createPropId('00000000-0000-4000-8000-000000000002');
const C = createPropId('00000000-0000-4000-8000-000000000003');
const prop = (propId: PropId): ClearEffect => ({
  target: {kind: 'prop', propId},
  since: 1000,
  durationMs: 500,
});
const props = (...ids: readonly PropId[]): LiveLayers => {
  const items = ids.map(propId => ({
    propId,
    content: {
      kind: 'image' as const,
      media: createMediaId('00000000-0000-4000-8000-000000000009'),
    },
    targets: [],
  }));
  const [first] = items;
  return {
    ...emptyLayers(),
    prop: first === undefined ? null : {propId: first.propId, items},
  };
};

it('keeps a cleared slide while it fades, and then not', () => {
  const fades = new ClearFades();
  fades.resolve({...emptyLayers(), slide}, [], 1000);
  const half = fades.resolve(emptyLayers(), [layer('slide')], 1250);
  expect(half.layers.slide).toBe(slide);
  expect(half.opacity.slide).toBe(0.5);
  expect(half.active).toBe(true);
  const over = fades.resolve(emptyLayers(), [layer('slide')], 1500);
  expect(over.layers.slide).toBeNull();
  expect(over.active).toBe(false);
});

it('keeps nothing that was not there', () => {
  const fades = new ClearFades();
  fades.resolve(emptyLayers(), [], 1000);
  expect(fades.resolve(emptyLayers(), [layer('media')], 1100).active).toBe(
    false,
  );
});

it('shows a new slide whole although the one before it was fading', () => {
  const fades = new ClearFades();
  fades.resolve({...emptyLayers(), slide}, [], 1000);
  fades.resolve(emptyLayers(), [layer('slide')], 1100);
  const next = {...slide, position: 1};
  const shown = fades.resolve(
    {...emptyLayers(), slide: next},
    [layer('slide')],
    1200,
  );
  expect(shown.layers.slide).toBe(next);
  expect(shown.opacity.slide).toBeUndefined();
});

it('fades one graphic out in its place among the others', () => {
  const fades = new ClearFades();
  fades.resolve(props(A, B, C), [], 1000);
  const half = fades.resolve(props(A, C), [prop(B)], 1250);
  expect(half.layers.prop?.items?.map(item => item.propId)).toEqual([A, B, C]);
  expect(half.propOpacity.get(B)).toBe(0.5);
  const over = fades.resolve(props(A, C), [prop(B)], 1600);
  expect(over.layers.prop?.items?.map(item => item.propId)).toEqual([A, C]);
});

it('forgets what it kept when it is disposed', () => {
  const fades = new ClearFades();
  fades.resolve({...emptyLayers(), slide}, [], 1000);
  fades.dispose();
  expect(fades.resolve(emptyLayers(), [layer('slide')], 1100).active).toBe(
    false,
  );
});
