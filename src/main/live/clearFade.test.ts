import {expect, it, vi} from 'vitest';
import {emptyLiveState, layerKinds} from '@core/live/state';
import {defaultPreferences} from '@core/schema/preferences';
import {LiveStore} from './store';
import {
  PROP,
  IMAGE_PROP,
  overlaySettings,
  settingsDocument,
  overlayUuid,
  MAIN,
  TEXT_STYLE,
} from './testing/overlays';
import {MAX_CLEAR_EFFECTS} from '@core/schema/clearFade';

const slide = {
  itemId: 'fade-check',
  position: 0,
  label: null,
  lines: ['Invented clear frame'],
};
const transition = {fade: true, durationMs: 1200};

function setup() {
  const settings = overlaySettings();
  const initial = emptyLiveState();
  const store = new LiveStore(
    {
      ...initial,
      layers: {
        ...initial.layers,
        slide,
        media: {mediaId: 'background', loop: true, startedAt: 100},
      },
    },
    {wall: () => 500, timer: () => 1000},
  );
  store.connectSettings({
    ...settings.reader,
    preferences: () => ({
      ...defaultPreferences,
      clearKeys: {slide: transition, all: transition},
    }),
  });
  return store;
}

it('uses key settings and clears the logical state immediately while stamping monotonic timing', () => {
  const store = setup();
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  expect(store.state.layers.slide).toBeNull();
  expect(store.state.clearEffects).toEqual([
    {target: {kind: 'layer', layer: 'slide'}, since: 1000, durationMs: 1200},
  ]);
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  expect(store.state.layers.slide).toEqual(slide);
  expect(store.state.clearEffects).toEqual([]);
});

it('keeps macro defaults instant and honors only their explicit timing', () => {
  const store = setup();
  store.dispatch({type: 'layer.clear', target: 'slide'});
  expect(store.state.clearEffects).toBeUndefined();
  store.dispatch({type: 'clear.undo'});
  store.dispatch({type: 'layer.clear', target: 'all', transition});
  expect(store.state.clearEffects?.map(effect => effect.target)).toEqual([
    {kind: 'layer', layer: 'media'},
    {kind: 'layer', layer: 'slide'},
  ]);
  store.dispatch({type: 'slide.show', slide: {...slide, position: 1}});
  expect(store.state.clearEffects?.map(effect => effect.target)).toEqual([
    {kind: 'layer', layer: 'media'},
  ]);
});

it.each([
  {fade: false, durationMs: 1200},
  {fade: true, durationMs: 0},
])('clears at once for a disabled or zero-duration choice %j', transition => {
  const store = setup();
  store.dispatch({type: 'layer.clear', target: 'slide', transition});
  expect(store.state.layers.slide).toBeNull();
  expect(store.state.clearEffects).toBeUndefined();
});

it('fades only a removed prop while retaining its neighbor and cancels it on undo', () => {
  const store = setup();
  store.dispatch({type: 'prop.set', propId: PROP, on: true});
  store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: true});
  store.dispatch({
    type: 'overlay.clear',
    target: {kind: 'prop', propId: PROP},
    transition,
  });
  expect(store.state.layers.prop?.items?.map(item => item.propId)).toEqual([
    IMAGE_PROP,
  ]);
  expect(store.state.clearEffects).toEqual([
    {target: {kind: 'prop', propId: PROP}, since: 1000, durationMs: 1200},
  ]);
  store.dispatch({type: 'clear.undo'});
  expect(store.state.clearEffects).toEqual([]);
  expect(store.state.layers.prop?.items).toHaveLength(2);
});

it('bounds repeated clear effects and drops them from recovered state', () => {
  const store = setup();
  for (let i = 0; i < 100; i += 1) {
    store.dispatch({type: 'slide.show', slide: {...slide, position: i}});
    store.dispatch({type: 'layer.clear.toggle', target: 'all'});
    expect(store.state.clearEffects?.length).toBeLessThanOrEqual(
      layerKinds.length,
    );
  }
  expect(new LiveStore(store.state).state.clearEffects).toEqual([]);
});

it('keeps independent prop timing when a later clear removes the last live prop', () => {
  const store = setup();
  store.dispatch({type: 'prop.set', propId: PROP, on: true});
  store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: true});
  for (const [propId, durationMs] of [
    [PROP, 1200],
    [IMAGE_PROP, 200],
  ] as const) {
    store.dispatch({
      type: 'overlay.clear',
      target: {kind: 'prop', propId},
      transition: {fade: true, durationMs},
    });
  }
  expect(store.state.layers.prop).toBeNull();
  expect(store.state.clearEffects).toEqual([
    {target: {kind: 'prop', propId: PROP}, since: 1000, durationMs: 1200},
    {target: {kind: 'prop', propId: IMAGE_PROP}, since: 1000, durationMs: 200},
  ]);
});

it('admits rotating prop clears in a batch by retaining only the newest bounded effects', () => {
  const settings = overlaySettings();
  const document = settingsDocument('props', {
    props: Array.from({length: 85}, (_, index) => ({
      id: overlayUuid(2000 + index),
      name: `Prop ${index}`,
      targets: [MAIN],
      content: {kind: 'text', text: `Prop ${index}`, style: TEXT_STYLE},
    })),
  });
  if (document.name !== 'props') throw new Error('Missing prop fixture');
  settings.update(document);
  const store = new LiveStore(undefined, () => 1000);
  store.connectSettings(settings.reader);
  const rejected = vi.fn();
  store.dispatch(
    {
      type: 'live.batch',
      commands: document.value.props.flatMap(prop => [
        {type: 'prop.set', propId: prop.id, on: true} as const,
        {
          type: 'overlay.clear',
          target: {kind: 'prop', propId: prop.id},
          transition: {fade: true, durationMs: 30000},
        } as const,
      ]),
    },
    rejected,
    rejected,
  );
  expect(rejected).not.toHaveBeenCalled();
  expect(store.state.layers.prop).toBeNull();
  expect(store.state.clearEffects).toHaveLength(MAX_CLEAR_EFFECTS);
  expect(store.state.clearEffects?.[0]?.target).toEqual({
    kind: 'prop',
    propId: overlayUuid(2015),
  });
  expect(store.state.clearEffects?.at(-1)?.target).toEqual({
    kind: 'prop',
    propId: overlayUuid(2084),
  });
});

it('replaces older individual prop effects when clearing the whole prop layer', () => {
  const store = setup();
  store.dispatch({type: 'prop.set', propId: PROP, on: true});
  store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: true});
  store.dispatch({
    type: 'overlay.clear',
    target: {kind: 'prop', propId: PROP},
    transition,
  });
  store.dispatch({
    type: 'layer.clear',
    target: 'prop',
    transition: {fade: true, durationMs: 200},
  });
  expect(store.state.clearEffects).toEqual([
    {target: {kind: 'layer', layer: 'prop'}, since: 1000, durationMs: 200},
  ]);
});
