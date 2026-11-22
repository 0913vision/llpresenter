import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/schema/live';
import {parseLiveState} from '@core/schema/liveState';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {MAIN_ID} from '@fixtures/core/screenDocuments';
import {BackgroundAudio} from '@renderer/output/backgroundAudio';
import {
  themeOutput,
  THEME_MAIN,
  THEME_CAPTURE,
} from '@fixtures/core/themeOutput';

function audioState() {
  const item = {id: 'audio-item', kind: 'media', source: 'external'} as const;
  return {
    ...emptyLiveState(),
    item,
    themeOutput: themeOutput(BUILT_IN_THEME_IDS.media),
  };
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

it('plays one soundtrack for several themed screens without reading legacy settings', async () => {
  const output = themeOutput(BUILT_IN_THEME_IDS.media);
  const state = {
    ...emptyLiveState(),
    themeOutput: output,
    item: {id: 'song', kind: 'media', source: 'external'} as const,
    outputs: {[THEME_MAIN]: true, [THEME_CAPTURE]: true},
    layers: {
      ...emptyLiveState().layers,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000004',
        itemId: 'song',
        loop: true,
        startedAt: 1000,
        properties: {speed: 1, fit: 'fit', volume: 50, audio: true} as const,
      },
    },
  };
  const root = document.createElement('div');
  const api = mockLlpApi();
  const mockRead = vi.spyOn(api.settings, 'get');
  const audio = new BackgroundAudio({
    root,
    api,
    muted: false,
    report: vi.fn(),
    now: () => 1000,
  });
  audio.show(state);
  await vi.waitFor(() =>
    expect(root.querySelectorAll('video[src]')).toHaveLength(1),
  );
  expect(root.querySelector<HTMLVideoElement>('video[src]')?.muted).toBe(false);
  audio.show(emptyLiveState());
  expect(root.querySelectorAll('video[src]')).toHaveLength(1);
  expect(mockRead).not.toHaveBeenCalled();
  audio.show({...state, outputs: {}});
  expect(root.querySelectorAll('video[src]')).toHaveLength(0);
  audio.dispose();
  expect(root.children).toHaveLength(0);
});

it('keeps media-item video muted when the hidden audio window is muted', async () => {
  const api = mockLlpApi();
  const parsed = parseLiveState({
    ...audioState(),
    outputs: {[MAIN_ID]: true},
    layers: {
      ...emptyLiveState().layers,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000004',
        itemId: 'audio-item',
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
  const api = mockLlpApi();
  const parsed = parseLiveState({
    ...audioState(),
    outputs: {[MAIN_ID]: true},
    layers: {
      ...emptyLiveState().layers,
      media: {
        mediaId: '00000000-0000-4000-8000-000000000004',
        itemId: 'audio-item',
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
    if (video === null) throw new Error('Missing media sound');
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
