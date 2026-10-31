import {beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  CAPTIONS_ID,
  LOOK_ID,
  MAIN_ID,
  screensDocument,
  settingsDocument,
} from '@core/testing/screenDocuments';
import {BackgroundAudio} from './backgroundAudio';

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

it('plays background sound once for multiple outputs, respects Looks, and releases it', async () => {
  const listeners = new Set<(document: SettingsDocument) => void>();
  const looks = (enabled: boolean, revision = 1) =>
    settingsDocument(
      'looks',
      {
        current: LOOK_ID,
        lyricStyles: [],
        looks: [
          {
            id: LOOK_ID,
            name: 'Fixture',
            screens: {
              [MAIN_ID]: {layers: {media: enabled}},
              [CAPTIONS_ID]: {layers: {media: enabled}},
            },
          },
        ],
      },
      revision,
    );
  const api = fakeLlpApi({
    settings: {
      get: ({name}) =>
        Promise.resolve(name === 'screens' ? screensDocument() : looks(true)),
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  const parsed = parseLiveState({
    ...emptyLiveState(),
    outputs: {[MAIN_ID]: true, [CAPTIONS_ID]: true},
    layers: {
      ...emptyLiveState().layers,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000004',
        loop: true,
        startedAt: 1000,
        properties: {speed: 2, fit: 'fit', volume: 40, audio: true},
      },
    },
  });
  if (!parsed.ok) throw new Error('Invalid live fixture');
  const root = document.createElement('div');
  const report = vi.fn();
  const audio = new BackgroundAudio({
    root,
    api,
    muted: false,
    report,
    now: () => 1000,
  });
  audio.show(parsed.value);
  await vi.waitFor(() =>
    expect(root.querySelectorAll('video[src]')).toHaveLength(1),
  );
  const video = root.querySelector<HTMLVideoElement>('video[src]');
  expect(video?.muted).toBe(false);
  expect(video?.volume).toBe(0.4);
  expect(video?.playbackRate).toBe(2);
  for (const listener of listeners) listener(looks(false, 2));
  expect(root.querySelectorAll('video[src]')).toHaveLength(0);
  for (const listener of listeners) listener(looks(true, 3));
  expect(root.querySelectorAll('video[src]')).toHaveLength(1);
  audio.show({...parsed.value, outputs: {}});
  expect(root.querySelectorAll('video[src]')).toHaveLength(0);
  audio.dispose();
  expect(listeners.size).toBe(0);
  expect(root.children).toHaveLength(0);
  expect(report).not.toHaveBeenCalled();
});

it('keeps background video muted when the hidden audio window is muted', async () => {
  const api = fakeLlpApi({
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'screens'
            ? screensDocument()
            : settingsDocument('looks', {
                current: LOOK_ID,
                looks: [],
                lyricStyles: [],
              }),
        ),
    },
  });
  const parsed = parseLiveState({
    ...emptyLiveState(),
    outputs: {[MAIN_ID]: true},
    layers: {
      ...emptyLiveState().layers,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000004',
        loop: true,
        startedAt: 1000,
        properties: {speed: 1, fit: 'fill', volume: 100, audio: true},
      },
    },
  });
  if (!parsed.ok) throw new Error('Invalid live fixture');
  const root = document.createElement('div');
  const audio = new BackgroundAudio({
    root,
    api,
    muted: true,
    report: vi.fn(),
    now: () => 1000,
  });
  audio.show(parsed.value);
  await vi.waitFor(() =>
    expect(root.querySelector('video[src]')).not.toBeNull(),
  );
  expect([...root.querySelectorAll('video')].every(video => video.muted)).toBe(
    true,
  );
  audio.dispose();
});

it('fades cleared video sound, cancels on restore, and resets gain after expiry', async () => {
  vi.useFakeTimers();
  let now = 1000;
  const api = fakeLlpApi({
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'screens'
            ? screensDocument()
            : settingsDocument('looks', {
                current: LOOK_ID,
                looks: [],
                lyricStyles: [],
              }),
        ),
    },
  });
  const parsed = parseLiveState({
    ...emptyLiveState(),
    outputs: {[MAIN_ID]: true},
    layers: {
      ...emptyLiveState().layers,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000004',
        loop: true,
        startedAt: 1000,
        properties: {speed: 1, fit: 'fill', volume: 40, audio: true},
      },
    },
  });
  if (!parsed.ok) throw new Error('Invalid live fixture');
  const root = document.createElement('div');
  const audio = new BackgroundAudio({
    root,
    api,
    muted: false,
    report: vi.fn(),
    now: () => now,
  });
  try {
    audio.show(parsed.value);
    await Promise.resolve();
    await Promise.resolve();
    const video = root.querySelector<HTMLVideoElement>('video[src]');
    if (video === null) throw new Error('Missing background sound');
    video.dispatchEvent(new Event('playing'));
    const cleared = {
      ...parsed.value,
      layers: {...parsed.value.layers, media: null},
      clearEffects: [
        {
          target: {kind: 'layer' as const, layer: 'media' as const},
          since: now,
          durationMs: 1000,
        },
      ],
    };
    audio.show(cleared);
    now += 500;
    vi.advanceTimersByTime(500);
    expect(video.volume).toBeCloseTo(0.2);
    vi.setSystemTime(5000);
    const media = parsed.value.layers.media;
    if (media === null) throw new Error('Missing media');
    audio.show({
      ...parsed.value,
      layers: {
        ...parsed.value.layers,
        media: {...media, startedAt: 4500, positionSeconds: 3},
      },
    });
    const restored = root.querySelector<HTMLVideoElement>('video[src]');
    if (restored === null) throw new Error('Missing restored sound');
    Object.defineProperty(restored, 'duration', {
      configurable: true,
      value: 100,
    });
    restored.dispatchEvent(new Event('loadedmetadata'));
    expect(restored.currentTime).toBe(3.5);
    expect(restored.volume).toBeCloseTo(0.4);
    vi.advanceTimersByTime(1000);
    expect(restored.hasAttribute('src')).toBe(true);
    audio.show({
      ...cleared,
      clearEffects: [
        {target: {kind: 'layer', layer: 'media'}, since: now, durationMs: 1000},
      ],
    });
    now += 1000;
    vi.advanceTimersByTime(1000);
    expect(root.querySelector('video[src]')).toBeNull();
    audio.show(parsed.value);
    expect(
      root.querySelector<HTMLVideoElement>('video[src]')?.volume,
    ).toBeCloseTo(0.4);
  } finally {
    audio.dispose();
    vi.useRealTimers();
  }
});
