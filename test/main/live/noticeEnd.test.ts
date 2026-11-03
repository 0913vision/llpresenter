import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LiveStore} from '@main/live/store';
import {followNoticeEnd} from '@main/live/noticeEnd';
import type {MediaList} from '@core/schema/mediaList';
import {IMAGES, NOTICE, overlaySettings} from '@fixtures/core/overlays';

const START = 1_700_000_000_000;

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

function setup() {
  const store = new LiveStore(undefined, () => Date.now());
  store.connectSettings(overlaySettings().reader);
  let present = [0, 1, 2];
  store.connectAudioMedia(() => library(present));
  const sent: unknown[] = [];
  const stop = followNoticeEnd({
    store,
    now: () => Date.now(),
    send: command => {
      sent.push(command);
      store.dispatch(command);
    },
  });
  return {
    store,
    stop,
    sent,
    leaveAll: () => {
      present = [];
      store.dispatch({type: 'notice.start', noticeId: NOTICE});
    },
    leaveOne: (index: number) => {
      present = present.filter(value => value !== index);
      store.dispatch({type: 'notice.start', noticeId: NOTICE});
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({now: START});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a 공지 whose every image left the library', () => {
  it('stops at the end of the interval of the last image on screen after the images leave one by one', () => {
    const {store, sent, leaveOne, stop} = setup();
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    vi.advanceTimersByTime(11_000);
    leaveOne(0);
    leaveOne(1);
    leaveOne(2);
    expect(store.state.layers.notice?.playback?.position).toBe(2);
    vi.advanceTimersByTime(3_900);
    expect(sent).toEqual([]);
    expect(store.state.layers.notice?.playback?.position).toBe(2);
    vi.advanceTimersByTime(200);
    expect(sent).toEqual([{type: 'notice.stop'}]);
    expect(store.state.layers.notice).toBeNull();
    stop();
  });

  it('keeps the image for its interval and then stops like notice.stop', () => {
    const {store, sent, leaveAll, stop} = setup();
    store.dispatch({type: 'notice.start', noticeId: NOTICE, position: 1});
    vi.advanceTimersByTime(2000);
    leaveAll();
    expect(store.state.layers.notice?.playback?.position).toBe(1);

    vi.advanceTimersByTime(2900);
    expect(store.state.layers.notice).not.toBeNull();
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(sent).toEqual([{type: 'notice.stop'}]);
    expect(store.state.layers.notice).toBeNull();
    stop();
  });

  it('does not stop a paused 공지, and ends the rest of the interval after it resumes', () => {
    const {store, sent, leaveAll, stop} = setup();
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    vi.advanceTimersByTime(1000);
    store.dispatch({type: 'notice.pause'});
    leaveAll();
    store.dispatch({type: 'notice.pause'});
    vi.advanceTimersByTime(60_000);
    expect(sent).toEqual([]);
    expect(store.state.layers.notice?.playback?.pausedAt).not.toBeNull();

    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    expect(store.state.layers.notice?.playback?.pausedAt).toBeNull();
    vi.advanceTimersByTime(3900);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(sent).toEqual([{type: 'notice.stop'}]);
    stop();
  });

  it('leaves a 공지 that still has an image alone, and stops its timer when disposed', () => {
    const {store, sent, stop} = setup();
    store.dispatch({type: 'notice.start', noticeId: NOTICE});
    vi.advanceTimersByTime(60_000);
    expect(sent).toEqual([]);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
