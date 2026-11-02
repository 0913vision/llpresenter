import {describe, expect, it} from 'vitest';
import {LiveStore} from '@main/live/store';
import type {MediaList} from '@core/schema/mediaList';
import {
  IMAGES,
  IMAGE_PROP,
  NOTICE,
  overlaySettings,
} from '@fixtures/core/overlays';

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
  const store = new LiveStore(undefined, () => 1_000);
  store.connectSettings(overlaySettings().reader);
  let current = present;
  store.connectAudioMedia(() => library(current));
  return {
    store,
    leave: (index: number) => {
      current = current.filter(value => value !== index);
    },
  };
}

describe('a 공지 whose images left the library', () => {
  it('lists the gone ids, starts on the first image that is left, and skips one that is gone when asked for', () => {
    const {store} = started([1, 2]);
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    const playback = store.state.layers.notice?.playback;
    expect(playback?.gone).toEqual([IMAGES[0]]);
    expect(playback?.position).toBe(1);

    store.dispatch({type: 'notice.stop'});
    store.dispatch({type: 'notice.start', noticeId: NOTICE, position: 0});
    expect(store.state.layers.notice).toBeNull();
  });

  it('plays nothing when every image is gone', () => {
    const {store} = started([]);
    expect(store.dispatch({type: 'notice.start', noticeId: NOTICE})).toBe(
      false,
    );
    expect(store.state.layers.notice).toBeNull();
  });

  it('keeps the place and the timing of a running 공지 when a refresh learns of a deletion', () => {
    const {store, leave} = started([0, 1, 2]);
    store.dispatch({type: 'notice.start', noticeId: NOTICE, position: 1});
    const before = store.state.layers.notice?.playback;
    expect(before?.gone).toBeUndefined();

    leave(1);
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    const after = store.state.layers.notice?.playback;
    expect(after).toMatchObject({
      gone: [IMAGES[1]],
      position: 1,
      startedAt: before?.startedAt,
    });
  });
});

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
