import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {createItemOverlayId, createMediaId} from '@core/schema/ids';
import {settingsDocument} from '@core/testing/settingsDocument';
import {looksDocument} from '@core/testing/screenDocuments';
import {
  themeElementBase,
  themeFile,
  themeScreens,
  THEME_MAIN,
} from '@core/testing/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {OutputRenderer} from '../rendering/outputRenderer';
import {classes} from '../rendering/classes';
import {BackgroundAudio} from './backgroundAudio';

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
  if (output === undefined) throw new Error('Missing theme output');
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

it.each([
  ['F2', 'slide'],
  ['F3', 'media'],
] as const)(
  'keeps overlay video and sound playing through %s and its clear fade',
  (_key, target) => {
    const root = document.createElement('div');
    const sound = document.createElement('div');
    const report = vi.fn();
    const renderer = new OutputRenderer(root, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: id => `https://media.test/${id}`,
      onError: report,
    });
    const api = mockLlpApi({
      settings: {
        get: ({name}) =>
          Promise.resolve(
            name === 'screens'
              ? settingsDocument('screens', {screens: themeScreens})
              : looksDocument(),
          ),
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
    const render = (state: LiveState) => {
      const output = state.themeOutput;
      const composition = output?.screens[THEME_MAIN];
      if (output === undefined || composition === undefined) {
        throw new Error('Missing screen');
      }
      renderer.render(state.layers, {
        screen: {id: THEME_MAIN, kind: 'audience'},
        theme: {
          ...composition,
          themeId: output.themeId,
          revision: output.revision,
          missing: output.missing,
          item: state.themeItem ?? null,
        },
        ...(state.clearEffects === undefined
          ? {}
          : {clearEffects: state.clearEffects}),
        timers: {
          list: [],
          runs: undefined,
          now: () => ({timer: now, wall: now}),
        },
      });
      audio.show(state);
    };
    try {
      const state = overlayState();
      render(state);
      const video = root.querySelector<HTMLVideoElement>(
        '[data-kind="overlay"] video[src]',
      );
      const soundtrack = sound.querySelector<HTMLVideoElement>('video[src]');
      const background = root.querySelector<HTMLVideoElement>(
        '[data-kind="background"] video[src]',
      );
      if (video === null || soundtrack === null || background === null) {
        throw new Error('Missing playback');
      }
      video.dispatchEvent(new Event('playing'));
      const mockPauseVideo = vi.fn();
      const mockPauseSound = vi.fn();
      const mockPauseBackground = vi.fn();
      video.pause = mockPauseVideo;
      soundtrack.pause = mockPauseSound;
      background.pause = mockPauseBackground;
      const source = video.src;
      const sourceSound = soundtrack.src;
      const cleared: LiveState = {
        ...state,
        layers: {...state.layers, [target]: null},
        clearEffects: [
          {
            target: {kind: 'layer', layer: target},
            since: now,
            durationMs: 1000,
          },
        ],
      };
      render(cleared);
      now += 500;
      render(cleared);
      expect(video.src).toBe(source);
      expect(soundtrack.src).toBe(sourceSound);
      expect(mockPauseVideo).not.toHaveBeenCalled();
      expect(mockPauseSound).not.toHaveBeenCalled();
      expect(video.muted).toBe(true);
      expect(soundtrack.muted).toBe(false);
      if (target === 'media') expect(mockPauseBackground).toHaveBeenCalled();
      now += 1000;
      render(cleared);
      expect(root.querySelector('[data-kind="overlay"] video[src]')).toBe(
        video,
      );
      expect(sound.querySelector('video[src]')).toBe(soundtrack);
      if (target === 'slide') {
        expect(
          root.querySelector(`[data-kind="currentText"] .${classes.shown}`),
        ).toBeNull();
      } else {
        expect(
          root.querySelector('[data-kind="background"] video[src]'),
        ).toBeNull();
      }
      expect(report).not.toHaveBeenCalled();
    } finally {
      renderer.dispose();
      audio.dispose();
    }
  },
);
