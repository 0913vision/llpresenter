import {resolveThemeOutput} from '@core/themes/output';
import {
  themeFile,
  themeScreens,
  THEME_MAIN,
  themeElementBase,
} from '@fixtures/core/themeOutput';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {
  mediaDocument,
  mediaItem,
  mediaId,
} from '@fixtures/renderer/features/media/mediaTesting';
import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {MediaProgress} from '@core/schema/mediaProgress';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {BACKGROUND_DISSOLVE_MS} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';
import {useLive} from '@renderer/session/live';
import {usePreview} from '@renderer/session/preview';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {
  BROADCAST_SCREEN,
  MAIN_SCREEN,
  STAGE_SCREEN,
} from '@fixtures/core/screenIds';

const progressListeners = new Set<(reading: MediaProgress | null) => void>();

class MockResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.useFakeTimers();
  progressListeners.clear();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  usePreview.setState({largeScreenId: MAIN_SCREEN});
  const themeItem = {
    id: 'preview-loop',
    kind: 'song',
    source: 'external',
  } as const;
  const themeOutput = resolveThemeOutput({
    file: themeFile(),
    screens: themeScreens,
    item: themeItem,
    revision: 1,
  });
  const initialMain = themeOutput.screens[THEME_MAIN];
  const main =
    initialMain === undefined
      ? undefined
      : {
          ...initialMain,
          layout: {
            ...initialMain.layout,
            elements: [
              ...initialMain.layout.elements,
              {...themeElementBase(99), kind: 'videoTimeLeft' as const},
            ],
          },
        };
  if (main === undefined) throw new Error('Missing main theme');
  useLive.setState({
    state: {
      ...emptyLiveState(),
      themeItem,
      themeOutput: {
        ...themeOutput,
        screens: Object.fromEntries(
          themeScreens.map(screen => [screen.id, main]),
        ),
      },
      outputs: {
        [MAIN_SCREEN]: true,
        [STAGE_SCREEN]: false,
        [BROADCAST_SCREEN]: false,
      },
      layers: {
        ...emptyLiveState().layers,
        media: {mediaId: mediaId(1), loop: true, startedAt: Date.now()},
      },
    },
  });
  window.llp = mockLlpApi({
    live: {
      send: vi.fn(),
      mediaProgress: async () => ({
        mediaId: mediaId(1),
        startedAt: useLive.getState().state?.layers.media?.startedAt ?? 1,
        positionSeconds: 0,
        durationSeconds: 12,
      }),
      subscribeMediaProgress: listener => {
        progressListeners.add(listener);
        return () => {
          progressListeners.delete(listener);
        };
      },
    },
    media: {
      get: async () =>
        mediaDocument([
          mediaItem(1, {duration: 12}),
          mediaItem(2, {
            kind: 'image',
            file: 'portrait.png',
            width: 200,
            height: 600,
          }),
          mediaItem(3, {kind: 'image', file: 'transparent.png'}),
        ]),
    },
    settings: {
      get: async ({name}) =>
        name === 'screens'
          ? settingsDocument('screens', {screens: themeScreens})
          : settingsDocument('timers', {timers: []}),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.llp;
});

describe('PreviewPanel real renderer lifecycle', () => {
  it('keeps the stage video countdown advancing without any video element', async () => {
    const {container, unmount} = render(<PreviewPanel />);
    await act(async () => {
      await Promise.resolve();
    });
    const countdowns = [
      ...container.querySelectorAll('[data-kind="videoTimeLeft"]'),
    ];
    expect(countdowns).toHaveLength(3);
    await act(async () => {
      for (const listener of progressListeners) {
        listener({
          mediaId: mediaId(1),
          startedAt: useLive.getState().state?.layers.media?.startedAt ?? 1,
          positionSeconds: 1,
          durationSeconds: 12,
        });
      }
      vi.advanceTimersByTime(1000);
    });
    expect(countdowns.map(view => view.textContent)).toEqual([
      '0:11',
      '0:11',
      '0:11',
    ]);
    await act(async () => {
      for (const listener of progressListeners) {
        listener({
          mediaId: mediaId(1),
          startedAt: useLive.getState().state?.layers.media?.startedAt ?? 1,
          positionSeconds: 3,
          durationSeconds: 12,
        });
      }
      vi.advanceTimersByTime(2000);
    });
    expect(countdowns.map(view => view.textContent)).toEqual([
      '0:09',
      '0:09',
      '0:09',
    ]);
    expect(container.querySelector('video')).toBeNull();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    {id: 2, name: 'portrait'},
    {id: 3, name: 'transparent'},
  ])(
    'keeps the original $name image instead of a cropped JPEG thumbnail',
    async ({id}) => {
      const live = useLive.getState().state;
      if (live === null) throw Error('Missing live state');
      useLive.setState({
        state: {
          ...live,
          layers: {
            ...live.layers,
            media: {mediaId: mediaId(id), loop: false, startedAt: Date.now()},
          },
        },
      });
      const {container, unmount} = render(<PreviewPanel />);
      await act(async () => {
        await Promise.resolve();
      });
      const images = [
        ...container.querySelectorAll<HTMLImageElement>('img[src]'),
      ];
      expect(images).toHaveLength(3);
      expect(
        images.every(
          image => image.getAttribute('src') === mediaUrl(mediaId(id)),
        ),
      ).toBe(true);
      expect(
        images.some(
          image => image.getAttribute('src') === thumbnailUrl(mediaId(id)),
        ),
      ).toBe(false);
      expect(container.querySelector('video')).toBeNull();
      unmount();
    },
  );

  it('keeps cached stills across selection and rerenders without ever creating video elements', async () => {
    const {container, rerender, unmount} = render(<PreviewPanel />);
    await act(async () => {
      await Promise.resolve();
    });
    const pictures = [...container.querySelectorAll('img')];
    const stills = [
      ...container.querySelectorAll<HTMLImageElement>('img[src]'),
    ];
    expect(container.querySelectorAll(`.${classes.root}`)).toHaveLength(3);
    expect(container.querySelector('video')).toBeNull();
    expect(stills).toHaveLength(3);
    expect(
      stills.every(image => image.src.startsWith('llp-media://thumbnail/')),
    ).toBe(true);
    for (const image of stills) fireEvent.load(image);
    await act(async () => {
      vi.advanceTimersByTime(BACKGROUND_DISSOLVE_MS);
    });
    const parents = pictures.map(image => image.parentElement);
    const live = useLive.getState().state;

    rerender(<PreviewPanel />);
    for (const name of ['무대 화면', '방송 화면', '청중 화면']) {
      fireEvent.click(screen.getByRole('button', {name: new RegExp(name)}));
      expect(container.querySelector('video')).toBeNull();
      expect([...container.querySelectorAll('img')]).toEqual(pictures);
      expect(pictures.map(image => image.parentElement)).toEqual(parents);
      expect(pictures.every(image => image.isConnected)).toBe(true);
      expect([...container.querySelectorAll('img[src]')]).toEqual(stills);
    }
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(useLive.getState().state).toBe(live);
    expect(window.llp?.live.send).not.toHaveBeenCalled();

    unmount();
    expect(pictures.every(image => !image.hasAttribute('src'))).toBe(true);
    expect(pictures.every(image => !image.isConnected)).toBe(true);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
