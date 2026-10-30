import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {BACKGROUND_DISSOLVE_MS} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';
import {useLive} from '@renderer/session/live';
import {usePreview} from '@renderer/session/preview';
import {PreviewPanel} from './PreviewPanel';
import {renderWithScreenSummaries as render} from '@renderer/app/shell/testing/screenSummaries';

class FakeResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  usePreview.setState({largeScreenId: 'main'});
  useLive.setState({
    state: {
      ...emptyLiveState(),
      outputs: {main: true, stage: false, broadcast: false},
      layers: {
        ...emptyLiveState().layers,
        media: {mediaId: 'preview-loop', loop: true, startedAt: Date.now()},
      },
    },
  });
  window.llp = fakeLlpApi({live: {send: vi.fn()}});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.llp;
});

describe('PreviewPanel real renderer lifecycle', () => {
  it('keeps all videos, their parents and playback positions across selection and resizing', () => {
    const {container, rerender, unmount} = render(
      <PreviewPanel compact={false} />,
    );
    const videos = [...container.querySelectorAll('video')];
    const playing = [
      ...container.querySelectorAll<HTMLVideoElement>('video[src]'),
    ];
    expect(container.querySelectorAll(`.${classes.root}`)).toHaveLength(3);
    expect(videos).toHaveLength(6);
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
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(6);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
  });
});
