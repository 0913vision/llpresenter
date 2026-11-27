import {expect, it} from 'vitest';
import type {SlideLayer} from '@core/schema/live/live';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {shownText} from '@fixtures/core/liveSlide';
import {LiveStore} from '@main/live/store';

function slide(text: string, number = 1): SlideLayer {
  return {itemId: 'song', position: number - 1, ...shownText(text, number)};
}

function setup() {
  let now = 100;
  const store = new LiveStore(undefined, () => now);
  return {
    store,
    at: (value: number) => {
      now = value;
    },
    shown: () => store.state.layers.slide,
  };
}

it('puts an edit of the live slide on the screens at once, keeping its running transition', () => {
  const {store, at, shown} = setup();
  store.dispatch({
    type: 'slide.show',
    slide: {...slide('주 하나님'), transition: {kind: 'wipe', sec: 4}},
  });
  const started = shown()?.transitionStartedAt;
  expect(started).toBe(100);
  at(900);
  expect(
    store.dispatch({type: 'slide.update', slide: slide('주 하나님 지으신')}),
  ).toBe(true);
  expect(shown()?.texts).toEqual({가사: '주 하나님 지으신'});
  expect(shown()?.transitionStartedAt).toBe(started);
});

it('ignores an edit of a slide that is not live, and an edit that changes nothing', () => {
  const {store, shown} = setup();
  store.dispatch({type: 'slide.show', slide: slide('첫 장', 1)});
  const version = store.state.version;
  expect(
    store.dispatch({type: 'slide.update', slide: slide('다른 장', 2)}),
  ).toBe(false);
  expect(store.dispatch({type: 'slide.update', slide: slide('첫 장', 1)})).toBe(
    false,
  );
  expect(shown()?.texts).toEqual({가사: '첫 장'});
  expect(store.state.version).toBe(version);
});

it('keeps an edit of the live slide when a clear made before it is undone', () => {
  const {store, shown} = setup();
  store.dispatch({type: 'slide.show', slide: slide('옛 가사')});
  store.dispatch({type: 'media.show', media: {mediaId: 'clip', loop: true}});
  store.dispatch({type: 'layer.clear', target: 'media'});
  store.dispatch({type: 'slide.update', slide: slide('고친 가사')});
  store.dispatch({type: 'clear.undo'});
  expect(store.state.layers.media?.mediaId).toBe('clip');
  expect(shown()?.texts).toEqual({가사: '고친 가사'});
});

it('changes the background with an edit that changes the theme of the live slide', () => {
  const {store, shown} = setup();
  store.dispatch({type: 'slide.show', slide: slide('가사')});
  store.dispatch({
    type: 'slide.update',
    slide: {...slide('가사'), theme: BUILT_IN_THEME_IDS.scripture},
  });
  expect(shown()?.theme).toBe(BUILT_IN_THEME_IDS.scripture);
});

it('turns the black screen on and off, and a slide shown turns it off', () => {
  const {store} = setup();
  store.dispatch({type: 'black.toggle'});
  expect(store.state.blackScreen).toBe(true);
  store.dispatch({type: 'black.toggle'});
  expect(store.state.blackScreen).toBe(false);
  store.dispatch({type: 'black.toggle'});
  store.dispatch({type: 'slide.show', slide: slide('가사')});
  expect(store.state.blackScreen).toBe(false);
});

it('shows a slide again at once, without its transition, while that transition runs', () => {
  const {store, at, shown} = setup();
  const wiped = {...slide('가사'), transition: {kind: 'wipe', sec: 4}} as const;
  store.dispatch({type: 'slide.show', slide: wiped});
  expect(shown()?.transitionStartedAt).toBe(100);
  at(500);
  store.dispatch({type: 'slide.show', slide: wiped});
  expect(shown()?.transitionStartedAt).toBeUndefined();
});
