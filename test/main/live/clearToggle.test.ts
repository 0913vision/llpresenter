import {expect, it} from 'vitest';
import type {ClearTarget} from '@core/live/commands';
import {emptyLiveState, layerKinds} from '@core/live/state';
import {LiveStore} from '@main/live/store';

const slide = {itemId: 'fixture', position: 0, label: null, lines: ['Current']};
function setup() {
  const initial = emptyLiveState();
  return new LiveStore(
    {
      ...initial,
      layers: {
        media: {mediaId: 'background', loop: true, startedAt: 0},
        slide,
        prop: {propId: 'prop'},
        audio: {mediaId: 'audio'},
        message: {messageId: 'message', text: 'Invented message'},
      },
    },
    {wall: () => 1000, timer: () => 1000},
  );
}

it('updates the live Bible passage title without changing the slide, black state, or clear undo', () => {
  const state = emptyLiveState();
  const bible = {...slide, reference: '요한복음 3:16', title: '요한복음 3:16'};
  const store = new LiveStore({
    ...state,
    layers: {
      ...state.layers,
      slide: bible,
      media: {mediaId: 'background', loop: true, startedAt: 0},
    },
    themeItem: {
      id: slide.itemId,
      kind: 'bible',
      source: 'external',
      title: '요한복음 3:16',
    },
  });
  store.dispatch({type: 'layer.clear', target: 'media'});
  store.dispatch({type: 'black.toggle'});
  store.dispatch({
    type: 'bible.passage.title.set',
    itemId: slide.itemId,
    position: 0,
    title: '요한복음 3:16~17',
  });
  expect(store.state.blackScreen).toBe(true);
  expect(store.state.canUndo).toBe(true);
  expect(store.state.themeItem?.title).toBe('요한복음 3:16~17');
  expect(store.state.layers.slide).toEqual({
    ...bible,
    title: '요한복음 3:16~17',
  });
  store.dispatch({
    type: 'bible.passage.title.set',
    itemId: 'other',
    position: 0,
    title: 'stale',
  });
  expect(store.state.themeItem?.title).toBe('요한복음 3:16~17');
  store.dispatch({type: 'clear.undo'});
  expect(store.state.layers.media?.mediaId).toBe('background');
  expect(store.state.themeItem?.title).toBe('요한복음 3:16~17');
  expect(store.state.layers.slide?.title).toBe('요한복음 3:16~17');
});

it.each<ClearTarget>(['all', ...layerKinds])(
  'clears and restores %s on successive key presses',
  target => {
    const store = setup();
    const layers = store.state.layers;
    store.dispatch({type: 'layer.clear.toggle', target});
    expect(store.state.clearToggles).toEqual([target]);
    expect(
      target === 'all'
        ? layerKinds.every(kind => store.state.layers[kind] === null)
        : store.state.layers[target] === null,
    ).toBe(true);
    store.dispatch({type: 'layer.clear.toggle', target});
    expect(store.state.layers).toEqual(layers);
    expect(store.state.clearToggles).toEqual([]);
    expect(store.state.canUndo).toBe(false);
  },
);

it('resets every key when a new slide is sent, so the next press clears again', () => {
  const store = setup();
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  store.dispatch({type: 'layer.clear.toggle', target: 'media'});
  const next = {...slide, position: 1, lines: ['New']};
  store.dispatch({type: 'slide.show', slide: next});
  expect(store.state.clearToggles).toEqual([]);
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  expect(store.state.layers.slide).toBeNull();
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  expect(store.state.layers.slide).toEqual(next);
  expect(store.state.layers.media).toBeNull();
});

it('restores only the layers each key cleared when F1 follows another key', () => {
  const store = setup();
  const layers = store.state.layers;
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  store.dispatch({type: 'layer.clear.toggle', target: 'all'});
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  expect(store.state.layers.slide).toEqual(slide);
  expect(store.state.layers.media).toBeNull();
  store.dispatch({type: 'layer.clear.toggle', target: 'all'});
  expect(store.state.layers).toEqual(layers);
});

it('keeps independent captures bounded to seven while keys repeatedly clear and restore', () => {
  const store = setup();
  for (let index = 0; index < 100; index += 1) {
    for (const target of layerKinds) {
      store.dispatch({type: 'layer.clear.toggle', target});
    }
    expect(store.state.clearToggles?.length).toBeLessThanOrEqual(7);
  }
  expect(store.state.clearToggles).toEqual([]);
});

it('keeps macro clears one-way and clears key captures after the optional undo', () => {
  const store = setup();
  store.dispatch({type: 'layer.clear', target: 'slide'});
  expect(store.dispatch({type: 'layer.clear', target: 'slide'})).toBe(false);
  expect(store.state.clearToggles).toBeUndefined();
  store.dispatch({type: 'clear.undo'});
  store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
  store.dispatch({type: 'clear.undo'});
  expect(store.state.layers.slide).toEqual(slide);
  expect(store.state.clearToggles).toEqual([]);
});

it('new stage text invalidates pending key restores', () => {
  const store = setup();
  store.dispatch({type: 'layer.clear.toggle', target: 'all'});
  store.dispatch({type: 'stage.message.set', text: 'New stage text'});
  expect(store.state.clearToggles).toEqual([]);
  expect(store.dispatch({type: 'layer.clear.toggle', target: 'all'})).toBe(
    false,
  );
});

it('drops saved restore flags when recovery has no in-memory clear captures', () => {
  const store = new LiveStore({...emptyLiveState(), clearToggles: ['slide']});
  expect(store.state.clearToggles).toEqual([]);
  expect(store.dispatch({type: 'layer.clear.toggle', target: 'slide'})).toBe(
    false,
  );
});

it.each(['media', 'message'] as const)(
  'keeps %s clear undo while updating stage preview',
  target => {
    const store = setup();
    const cleared = store.state.layers[target];
    store.dispatch({type: 'layer.clear', target});
    expect(store.state.canUndo).toBe(true);
    store.dispatch({
      type: 'stage.next.set',
      itemId: slide.itemId,
      position: slide.position,
      next: {label: null, lines: ['Next']},
    });
    expect(store.state.canUndo).toBe(true);
    expect(store.state.layers.slide).toEqual({
      ...slide,
      next: {label: null, lines: ['Next']},
    });
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers[target]).toEqual(cleared);
    expect(store.state.layers.slide).toEqual({
      ...slide,
      next: {label: null, lines: ['Next']},
    });
  },
);

it('keeps a clear toggle capture when the stage preview changes', () => {
  const store = setup();
  store.dispatch({type: 'layer.clear.toggle', target: 'media'});
  store.dispatch({
    type: 'stage.next.set',
    itemId: slide.itemId,
    position: slide.position,
    next: {label: null, lines: ['Next']},
  });
  expect(store.state.clearToggles).toEqual(['media']);
  store.dispatch({type: 'layer.clear.toggle', target: 'media'});
  expect(store.state.layers.media?.mediaId).toBe('background');
});

it('toggles black without changing the live slide, media, audio or overlays', () => {
  const store = setup();
  const layers = store.state.layers;
  store.dispatch({type: 'black.toggle'});
  expect(store.state.blackScreen).toBe(true);
  expect(store.state.layers).toEqual(layers);
  store.dispatch({type: 'black.toggle'});
  expect(store.state.blackScreen).toBe(false);
  expect(store.state.layers).toEqual(layers);
});

it('removes black when a slide is shown, including the same slide', () => {
  const store = setup();
  const audio = store.state.layers.audio;
  const props = store.state.layers.prop;
  store.dispatch({type: 'black.toggle'});
  store.dispatch({
    type: 'slide.show',
    slide: {...slide, transition: {kind: 'wipe', dir: 'left', sec: 1}},
  });
  expect(store.state.blackScreen).toBe(false);
  expect(store.state.layers.slide?.transitionStartedAt).toBe(1000);
  expect(store.state.layers.audio).toBe(audio);
  expect(store.state.layers.prop).toBe(props);
});
