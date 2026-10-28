import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {parseLiveState} from '@shared/schema/liveState';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {createMediaId} from '@shared/schema/ids';
import {audioPositionSeconds} from '@shared/schema/audioState';
import {recordingLogger} from '../displays/testing';
import {connectMediaPlayback} from './mediaPlayback';
import {LiveStore} from './store';

const VIDEO = createMediaId('00000000-0000-4000-8000-000000000001');
const AUDIO = createMediaId('00000000-0000-4000-8000-000000000002');

function document(speed = 2, volume = 40) {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: [VIDEO, AUDIO].map(id => ({
        id,
        name: 'Fixture',
        kind: id === VIDEO ? 'video' : 'audio',
        file: `${id}.wav`,
        size: 0,
        props: {speed, volume, fit: 'fit', audio: true},
      })),
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
}

describe('media playback properties', () => {
  it('keeps current audio and background anchors when undoing an unrelated clear', () => {
    let now = 1000;
    let current = document(1);
    let changed = (): void => {};
    const store = new LiveStore(undefined, () => now);
    const stop = connectMediaPlayback(
      store,
      {
        get: () => current,
        subscribe: listener => {
          changed = () => listener(current);
          return () => {};
        },
      },
      recordingLogger(),
    );
    store.dispatch({
      type: 'audio.play',
      source: {kind: 'media', mediaId: AUDIO},
    });
    store.dispatch({type: 'media.show', media: {mediaId: VIDEO, loop: true}});
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'invented', position: 0, label: null, lines: ['Example']},
    });
    store.dispatch({type: 'layer.clear', target: 'slide'});
    now += 5000;
    current = document(2);
    changed();
    const audio = store.state.layers.audio;
    const media = store.state.layers.media;
    now += 5000;
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.slide?.lines).toEqual(['Example']);
    expect(store.state.layers.audio).toBe(audio);
    expect(store.state.layers.media).toBe(media);
    const playback = store.state.layers.audio?.playback;
    if (playback === undefined) throw new Error('Missing playback');
    expect(
      audioPositionSeconds(
        playback,
        now,
        store.state.layers.audio?.properties?.speed,
      ),
    ).toBe(15);
    stop();
  });
  it('restores current media properties when a clear toggle is undone', () => {
    let now = 1000;
    let current = document();
    let changed = (): void => {};
    const store = new LiveStore(undefined, () => now);
    const stop = connectMediaPlayback(
      store,
      {
        get: () => current,
        subscribe: listener => {
          changed = () => listener(current);
          return () => {};
        },
      },
      recordingLogger(),
    );
    store.dispatch({type: 'media.show', media: {mediaId: VIDEO, loop: true}});
    now += 2000;
    store.dispatch({type: 'layer.clear.toggle', target: 'media'});
    current = document(0.5, 20);
    changed();
    now += 5000;
    store.dispatch({type: 'layer.clear.toggle', target: 'media'});
    expect(store.state.layers.media).toMatchObject({
      properties: {speed: 0.5, volume: 20},
      positionSeconds: 4,
      startedAt: now,
    });
    stop();
  });
  it('updates both live paths while preserving positions, pause and clear undo', () => {
    let now = 1000;
    let current = document();
    let changed = (): void => {};
    const release = vi.fn();
    const store = new LiveStore(undefined, () => now);
    const stop = connectMediaPlayback(
      store,
      {
        get: () => current,
        subscribe: listener => {
          changed = () => listener(current);
          return release;
        },
      },
      recordingLogger(),
    );
    store.dispatch({type: 'media.show', media: {mediaId: VIDEO, loop: true}});
    store.dispatch({
      type: 'audio.play',
      source: {kind: 'media', mediaId: AUDIO},
    });
    expect(store.state.layers.media?.properties).toMatchObject({
      speed: 2,
      fit: 'fit',
      volume: 40,
    });
    expect(store.state.layers.audio?.properties?.speed).toBe(2);
    const playback = store.state.layers.audio?.playback;
    current = document(2, 70);
    changed();
    expect(store.state.layers.audio?.playback).toBe(playback);
    now += 2000;
    current = document(0.5, 70);
    changed();
    expect(store.state.layers.audio?.playback).toMatchObject({
      positionSeconds: 4,
      since: now,
    });
    expect(store.state.layers.media).toMatchObject({
      positionSeconds: 4,
      startedAt: now,
    });
    now += 2000;
    store.dispatch({type: 'audio.pause'});
    expect(store.state.layers.audio?.playback?.positionSeconds).toBe(5);
    store.dispatch({type: 'layer.clear', target: 'audio'});
    now += 10_000;
    current = document(1, 20);
    changed();
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.audio).toMatchObject({
      properties: {speed: 1, volume: 20},
      playback: {positionSeconds: 5, since: null},
    });
    stop();
    const last = store.state;
    changed();
    expect(store.state).toBe(last);
    expect(release).toHaveBeenCalledOnce();
  });

  it('bounds future speed values without modifying the media document', () => {
    const current = document(100);
    const store = new LiveStore();
    const stop = connectMediaPlayback(
      store,
      {get: () => current, subscribe: () => () => {}},
      recordingLogger(),
    );
    store.dispatch({
      type: 'audio.play',
      source: {kind: 'media', mediaId: AUDIO},
    });
    expect(store.state.layers.audio?.properties?.speed).toBe(4);
    expect(current.value.items[0]?.props?.speed).toBe(100);
    stop();
  });

  it.each([
    {speed: 0},
    {speed: Infinity},
    {fit: 'bad'},
    {volume: 101},
    {audio: 'yes'},
  ])('rejects invalid output snapshots %j', change => {
    const initial = emptyLiveState();
    expect(
      parseLiveState({
        ...initial,
        layers: {
          ...initial.layers,
          audio: {
            mediaId: AUDIO,
            properties: {
              speed: 1,
              fit: 'fill',
              volume: 100,
              audio: true,
              ...change,
            },
          },
        },
      }).ok,
    ).toBe(false);
  });
  it('accepts the bounded refresh command', () => {
    expect(parseLiveCommand({type: 'media.properties.refresh'}).ok).toBe(true);
  });
});
