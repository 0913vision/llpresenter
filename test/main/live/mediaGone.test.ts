import {describe, expect, it} from 'vitest';
import type {} from '@core/live/state';
import {LiveStore} from '@main/live/store';
import type {MediaList} from '@core/schema/mediaList';
import {IMAGES, IMAGE_PROP, overlaySettings} from '@fixtures/core/overlays';

function library(present: readonly number[]): MediaList {
  return {
    format: 'llmedia',
    schemaVersion: 1,
    items: present.flatMap(index => {
      const id = IMAGES[index];
      return id === undefined
        ? []
        : [
            {
              id,
              name: `Image ${index}`,
              kind: 'image' as const,
              file: 'a.png',
              size: 1,
            },
          ];
    }),
    playlists: [],
    audioPlaylists: [],
  };
}

function started(present: number[]) {
  let now = 1_000;
  const store = new LiveStore(undefined, () => now);
  store.connectSettings(overlaySettings().reader);
  let current = present;
  store.connectAudioMedia(() => library(current));
  return {
    store,
    setNow: (value: number) => {
      now = value;
    },
    leave: (index: number) => {
      current = current.filter(value => value !== index);
    },
  };
}

describe('a 그래픽 whose image left the library', () => {
  it('cannot be shown, and one on screen can still be taken down', () => {
    const {store, leave} = started([0]);
    expect(
      store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: true}),
    ).toBe(true);
    leave(0);
    expect(
      store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: true}),
    ).toBe(false);
    expect(
      store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: false}),
    ).toBe(true);
    expect(store.state.layers.prop?.items ?? []).toEqual([]);
    expect(
      store.dispatch({type: 'prop.set', propId: IMAGE_PROP, on: true}),
    ).toBe(false);
  });
});

describe('a background that left the library', () => {
  it('stays on screen through the slide it was drawn behind and is not drawn behind the next one', () => {
    const {store, leave} = started([0]);
    const first = IMAGES[0];
    if (first === undefined) throw new Error('No id');
    const media = {mediaId: first, loop: false};
    const slide = (text: string) => ({
      type: 'slide.show' as const,
      slide: {itemId: 'item', position: 0, label: null, lines: [text]},
    });
    store.dispatch({type: 'media.show', media});
    store.dispatch(slide('first'));
    expect(store.state.layers.media?.mediaId).toBe(IMAGES[0]);

    leave(0);
    expect(store.state.layers.media?.mediaId).toBe(IMAGES[0]);
    store.dispatch(slide('second'));
    expect(store.state.layers.media).toBeNull();
    expect(store.state.layers.slide).toMatchObject({lines: ['second']});
  });

  it('keeps a background that is still in the library', () => {
    const {store} = started([0]);
    const first = IMAGES[0];
    if (first === undefined) throw new Error('No id');
    store.dispatch({type: 'media.show', media: {mediaId: first, loop: false}});
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'item', position: 0, label: null, lines: ['first']},
    });
    expect(store.state.layers.media?.mediaId).toBe(IMAGES[0]);
  });
});
