import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createItemOverlayId, createMediaId} from '@core/schema/ids';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  themeElementBase,
  themeFile,
  themeScreens,
  THEME_MAIN,
} from '@fixtures/core/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {BackgroundAudio} from '@renderer/output/backgroundAudio';

function overlayState(): LiveState {
  const file = themeFile();
  const song = file.themes[0];
  if (song === undefined) throw new Error('Missing song theme');
  const output = resolveThemeOutput({
    file: {
      ...file,
      themes: [
        {
          ...song,
          screens: {
            [THEME_MAIN]: {
              mode: {kind: 'own'},
              elements: [
                {
                  ...themeElementBase(),
                  kind: 'background',
                  fit: 'fit',
                  radius: 0,
                },
                {...themeElementBase(31), kind: 'overlay', fit: 'fit'},
                {...themeElementBase(32), kind: 'currentText'},
              ],
            },
          },
        },
      ],
    },
    screens: themeScreens,
    item: {id: 'song', kind: 'song', source: 'external'},
    revision: 1,
  });
  return {
    ...emptyLiveState(),
    themeOutput: output,
    outputs: {[THEME_MAIN]: true},
    themeItem: {
      id: 'song',
      kind: 'song',
      source: 'service',
      slidePosition: 1,
      overlayStartedAt: 1000,
      overlays: [
        {
          id: createItemOverlayId('00000000-0000-4000-8000-000000000701'),
          name: 'Invented overlay',
          from: 1,
          to: 3,
          screens: [THEME_MAIN],
          content: {
            media: createMediaId('00000000-0000-4000-8000-000000000702'),
            loop: true,
            sound: true,
          },
        },
      ],
    },
    layers: {
      ...emptyLiveState().layers,
      slide: {
        itemId: 'song',
        position: 1,
        label: null,
        lines: ['Invented line'],
      },
      media: {
        mediaId: '00000000-0000-4000-8000-000000000703',
        loop: true,
        startedAt: 1000,
      },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
afterEach(() => vi.useRealTimers());

function cleared(
  state: LiveState,
  target: 'slide' | 'media',
  since: number,
): LiveState {
  return {
    ...state,
    layers: {...state.layers, [target]: null},
    clearEffects: [
      {target: {kind: 'layer', layer: target}, since, durationMs: 1000},
    ],
  };
}

it.each([
  ['F2', 'slide'],
  ['F3', 'media'],
] as const)(
  'keeps the theme overlay sound playing through %s and its clear fade',
  (_key, target) => {
    const sound = document.createElement('div');
    const report = vi.fn();
    const api = mockLlpApi({
      settings: {
        get: () =>
          Promise.resolve(settingsDocument('screens', {screens: themeScreens})),
      },
    });
    let now = 1000;
    const audio = new BackgroundAudio({
      root: sound,
      api,
      muted: false,
      report,
      now: () => now,
    });
    try {
      const state = overlayState();
      audio.show(state);
      const soundtrack = sound.querySelector<HTMLVideoElement>('video[src]');
      if (soundtrack === null) throw new Error('Missing playback');
      const mockPauseSound = vi.fn();
      soundtrack.pause = mockPauseSound;
      const sourceSound = soundtrack.src;
      const after = cleared(state, target, now);

      audio.show(after);
      now += 500;
      audio.show(after);
      expect(soundtrack.src).toBe(sourceSound);
      expect(mockPauseSound).not.toHaveBeenCalled();
      expect(soundtrack.muted).toBe(false);
      now += 1000;
      audio.show(after);

      expect(sound.querySelector('video[src]')).toBe(soundtrack);
      expect(report).not.toHaveBeenCalled();
    } finally {
      audio.dispose();
    }
  },
);
