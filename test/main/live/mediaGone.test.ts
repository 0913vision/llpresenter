import {describe, expect, it} from 'vitest';
import {
  nextNoticeChange,
  noticePosition,
  noticeStopDelay,
} from '@core/overlays/noticeClock';
import type {NoticePlayback} from '@core/live/state';
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

describe('a running 공지 and a media change', () => {
  it('keeps the image on screen when its last image leaves, and a start does nothing', () => {
    const {store, leave} = started([0, 1, 2]);
    store.dispatch({type: 'notice.start', noticeId: NOTICE, position: 1});
    leave(0);
    leave(1);
    leave(2);
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    expect(store.state.layers.notice?.playback).toMatchObject({
      gone: [IMAGES[0], IMAGES[1], IMAGES[2]],
      position: 1,
      startedAt: 1_000,
    });
    store.dispatch({type: 'notice.stop'});
    expect(store.dispatch({type: 'notice.start', noticeId: NOTICE})).toBe(
      false,
    );
    expect(store.state.layers.notice).toBeNull();
  });

  it('keeps the held image and its elapsed time of a paused 공지 through a media change', () => {
    const {store, setNow, leave} = started([0, 1, 2]);
    store.dispatch({type: 'notice.start', noticeId: NOTICE, position: 1});
    setNow(3_000);
    store.dispatch({type: 'notice.pause'});
    const held = store.state.layers.notice?.playback;
    expect(held?.pausedAt).toBe(3_000);
    const elapsed = (held?.pausedAt ?? 0) - (held?.startedAt ?? 0);

    for (const [at, gone] of [
      [9_000, undefined],
      [20_000, 2],
    ] as const) {
      setNow(at);
      if (gone !== undefined) leave(gone);
      store.dispatch({type: 'notice.start', noticeId: NOTICE});
      store.dispatch({type: 'notice.pause'});
      const after = store.state.layers.notice?.playback;
      expect(after?.position).toBe(1);
      expect((after?.pausedAt ?? 0) - (after?.startedAt ?? 0)).toBe(elapsed);
      expect(after?.pausedAt).not.toBeNull();
    }
    expect(store.state.layers.notice?.playback?.gone).toEqual([IMAGES[2]]);
  });
});

describe('a 공지 that is on its last image when they all leave', () => {
  it('keeps the third image on screen through the deletions and the rest of its interval', () => {
    const {store, setNow, leave} = started([0, 1, 2]);
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    const playback = (): NoticePlayback => {
      const value = store.state.layers.notice?.playback;
      if (value === undefined) throw new Error('No 공지 is running');
      return value;
    };
    expect(noticePosition(playback(), 1_000 + 11_500)).toBe(2);

    for (const [index, at] of [
      [0, 12_600],
      [1, 12_800],
      [2, 13_000],
    ] as const) {
      setNow(at);
      leave(index);
      store.dispatch({type: 'notice.start', noticeId: NOTICE});
      expect(noticePosition(playback(), at)).toBe(2);
      expect(noticePosition(playback(), 15_900)).toBe(2);
    }
    expect(playback().gone).toHaveLength(3);
    expect(playback().position).toBe(2);
    expect(noticeStopDelay(playback(), 13_000)).toBe(3_000);
  });
});

describe('a plain edit of a running 공지', () => {
  it('leaves the shown image and the time of the next change as they were', () => {
    const {store, setNow} = started([0, 1, 2]);
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    setNow(1_000 + 6_500);
    const before = store.state.layers.notice?.playback;
    if (before === undefined) throw new Error('No 공지 is running');
    const now = 1_000 + 6_500;
    expect(noticePosition(before, now)).toBe(1);

    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    const after = store.state.layers.notice?.playback;
    if (after === undefined) throw new Error('No 공지 is running');
    expect(noticePosition(after, now)).toBe(noticePosition(before, now));
    expect(nextNoticeChange(after, now)).toBe(nextNoticeChange(before, now));
    expect(noticePosition(after, now + 20_000)).toBe(
      noticePosition(before, now + 20_000),
    );
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
