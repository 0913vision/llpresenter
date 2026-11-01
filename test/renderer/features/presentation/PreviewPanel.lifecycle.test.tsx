import {resolveThemeOutput} from '@core/themes/output';
import {themeFile, themeScreens, THEME_MAIN} from '@fixtures/core/themeOutput';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {BACKGROUND_DISSOLVE_MS} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';
import {useLive} from '@renderer/session/live';
import {usePreview} from '@renderer/session/preview';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';

class MockResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  usePreview.setState({largeScreenId: 'main'});
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
  const main = themeOutput.screens[THEME_MAIN];
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
      outputs: {main: true, stage: false, broadcast: false},
      layers: {
        ...emptyLiveState().layers,
        media: {mediaId: 'preview-loop', loop: true, startedAt: Date.now()},
      },
    },
  });
  window.llp = mockLlpApi({
    live: {send: vi.fn()},
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
  it('keeps all videos, their parents and playback positions across selection and resizing', async () => {
    const {container, rerender, unmount} = render(
      <PreviewPanel compact={false} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const videos = [...container.querySelectorAll('video')];
    const playing = [
      ...container.querySelectorAll<HTMLVideoElement>('video[src]'),
    ];
    expect(container.querySelectorAll(`.${classes.root}`)).toHaveLength(3);
    expect(videos.length).toBeGreaterThanOrEqual(playing.length);
    expect(playing).toHaveLength(3);
    for (const video of playing) fireEvent.playing(video);
    act(() => {
      vi.advanceTimersByTime(BACKGROUND_DISSOLVE_MS);
    });
    for (const [index, video] of playing.entries()) {
      video.currentTime = 12 + index;
    }
    const parents = videos.map(video => video.parentElement);
    const live = useLive.getState().state;
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    vi.mocked(HTMLMediaElement.prototype.load).mockClear();

    for (const compact of [true, false]) {
      rerender(<PreviewPanel compact={compact} />);
      for (const name of ['무대 화면', '방송 자막', '본 화면', '본 화면']) {
        fireEvent.click(screen.getByRole('button', {name: new RegExp(name)}));
        expect([...container.querySelectorAll('video')]).toEqual(videos);
        expect(videos.map(video => video.parentElement)).toEqual(parents);
        expect(videos.every(video => video.isConnected)).toBe(true);
        expect(playing.map(video => video.currentTime)).toEqual([12, 13, 14]);
        expect([...container.querySelectorAll('video[src]')]).toEqual(playing);
      }
    }
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(useLive.getState().state).toBe(live);
    expect(window.llp?.live.send).not.toHaveBeenCalled();

    unmount();
    expect(videos.every(video => !video.hasAttribute('src'))).toBe(true);
    expect(videos.every(video => !video.isConnected)).toBe(true);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(
      videos.length,
    );
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(
      videos.length,
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
