import {fireEvent, render, screen} from '@testing-library/react';
import {StrictMode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {mediaUrl} from '@shared/media';
import type {MediaItem} from '@shared/schema/mediaList';
import {MediaPreviewPlayer} from './MediaPreviewPlayer';
import {mediaId, mediaItem} from './mediaTesting';

const seeks: number[] = [];

beforeEach(() => {
  seeks.length = 0;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

function setTime(element: HTMLMediaElement, seconds: number): void {
  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    get: () => seconds,
    set: (value: number) => {
      seeks.push(value);
    },
  });
}

function player(item: MediaItem, missing = false) {
  const onReveal = vi.fn();
  const view = render(
    <MediaPreviewPlayer item={item} missing={missing} onReveal={onReveal} />,
  );
  const media = view.container.querySelector<HTMLMediaElement>('video, audio');
  return {...view, onReveal, media};
}

describe('media preview player', () => {
  afterEach(resetTooltips);

  it.each(['video', 'audio'] as const)(
    'restores the %s source after the StrictMode setup probe and releases it on unmount',
    kind => {
      const item = mediaItem(1, {kind});
      const view = render(
        <StrictMode>
          <MediaPreviewPlayer item={item} missing={false} onReveal={vi.fn()} />
        </StrictMode>,
      );
      const element = view.container.querySelector('video, audio');
      expect(element?.getAttribute('src')).toBe(mediaUrl(item.id));
      fireEvent.click(screen.getByRole('button', {name: '재생'}));
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
      view.unmount();
      expect(element?.hasAttribute('src')).toBe(false);
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    {speed: 0.001, applied: 0.25},
    {speed: 100, applied: 4},
  ])(
    'bounds saved speed $speed to $applied for playback',
    ({speed, applied}) => {
      const item = mediaItem(1, {props: {speed}});
      const {media} = player(item);
      expect(media?.playbackRate).toBe(applied);
      expect(item.props?.speed).toBe(speed);
    },
  );

  it('keeps the preview available when a bounded rate is rejected and falls back to normal speed', () => {
    const error = new DOMException(
      'Invented unsupported rate',
      'NotSupportedError',
    );
    const rate = vi
      .spyOn(HTMLMediaElement.prototype, 'playbackRate', 'set')
      .mockImplementation(value => {
        if (value !== 1) throw error;
      });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const {media} = player(mediaItem(1, {props: {speed: 2}}));
    expect(rate.mock.calls).toEqual([[2], [1]]);
    expect(media?.playbackRate).toBe(1);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Could not set the media preview playback rate',
      error,
    );
    fireEvent.click(screen.getByRole('button', {name: '재생'}));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
  });

  it('logs both failures when the engine also rejects the fallback rate', () => {
    const error = new DOMException(
      'Invented rate failure',
      'NotSupportedError',
    );
    vi.spyOn(
      HTMLMediaElement.prototype,
      'playbackRate',
      'set',
    ).mockImplementation(() => {
      throw error;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => player(mediaItem(1, {props: {speed: 100}}))).not.toThrow();
    expect(warn.mock.calls).toEqual([
      ['Could not set the media preview playback rate', error],
      ['Could not reset the media preview playback rate', error],
    ]);
    expect(screen.getByRole('button', {name: '재생'})).toBeDefined();
  });

  it('restarts the selected range at the natural file end for 반복', () => {
    const {media} = player(mediaItem(1, {duration: 30, props: {in: 2}}));
    if (media === null) throw new Error('No media element');
    setTime(media, 30);
    fireEvent.ended(media);
    expect(seeks).toEqual([2]);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
  });

  it('shows 재생 after the natural file end for 멈춤', () => {
    const {media} = player(mediaItem(1, {duration: 30, props: {end: 'stop'}}));
    if (media === null) throw new Error('No media element');
    fireEvent.play(media);
    expect(screen.getByRole('button', {name: '일시 정지'})).toBeDefined();
    fireEvent.ended(media);
    expect(screen.getByRole('button', {name: '재생'})).toBeDefined();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('releases a removed element and configures and releases its replacement after relinking', () => {
    const item = mediaItem(1, {props: {audio: false, volume: 40, speed: 1.1}});
    const view = player(item);
    const original = view.media;
    view.rerender(
      <MediaPreviewPlayer item={item} missing onReveal={vi.fn()} />,
    );
    expect(original?.hasAttribute('src')).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    view.rerender(
      <MediaPreviewPlayer item={item} missing={false} onReveal={vi.fn()} />,
    );
    const replacement = view.container.querySelector('video');
    expect(replacement?.muted).toBe(true);
    expect(replacement?.volume).toBe(0.4);
    expect(replacement?.playbackRate).toBe(1.1);
    view.unmount();
    expect(replacement?.hasAttribute('src')).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  });

  it('logs a refused playback and keeps the play control available', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('Invented decoder refusal');
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(error);
    player(mediaItem(1));
    fireEvent.click(screen.getByRole('button', {name: '재생'}));
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        'Could not play the media preview',
        error,
      ),
    );
    expect(screen.getByRole('button', {name: '재생'})).toBeDefined();
  });

  it.each(['재생', '파일 위치 열기'])(
    'explains why %s is unavailable for a missing file',
    async name => {
      player(mediaItem(1), true);
      expect(
        (await hoverForTooltip(screen.getByRole('button', {name})))
          ?.textContent,
      ).toBe('파일을 찾을 수 없음');
    },
  );
  it('plays a video in this window from its media URL and pauses it', () => {
    const {media} = player(mediaItem(1));
    expect(media?.getAttribute('src')).toBe(mediaUrl(mediaId(1)));
    fireEvent.click(screen.getByRole('button', {name: '재생'}));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    if (media) fireEvent.play(media);
    fireEvent.click(screen.getByRole('button', {name: '일시 정지'}));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
  });

  it('plays with the sound, volume, and speed of the item', () => {
    expect(player(mediaItem(1)).media?.muted).toBe(true);
    const {media} = player(
      mediaItem(2, {props: {audio: true, volume: 40, speed: 2}}),
    );
    expect(media?.muted).toBe(false);
    expect(media?.volume).toBe(0.4);
    expect(media?.playbackRate).toBe(2);
  });

  it('stops or loops at the end of the range', () => {
    const stops = player(
      mediaItem(1, {duration: 30, props: {in: 2, out: 10, end: 'stop'}}),
    ).media;
    if (stops === null) throw new Error('No media element');
    setTime(stops, 10.5);
    fireEvent.timeUpdate(stops);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    const loops = player(
      mediaItem(2, {duration: 30, props: {in: 2, out: 10}}),
    ).media;
    if (loops === null) throw new Error('No media element');
    setTime(loops, 10.5);
    fireEvent.timeUpdate(loops);
    expect(seeks).toEqual([2]);
  });

  it('shows the position and the time left', () => {
    const {media} = player(mediaItem(1, {duration: 30}));
    expect(screen.getByText('0:00')).toBeDefined();
    expect(screen.getByText('0:30 남음')).toBeDefined();
    if (media === null) throw new Error('No media element');
    setTime(media, 12);
    fireEvent.timeUpdate(media);
    expect(screen.getByText('0:12')).toBeDefined();
    expect(screen.getByText('0:18 남음')).toBeDefined();
  });

  it('shows an image without a play button, and a missing file without playing', () => {
    const image = player(mediaItem(1, {kind: 'image', file: 'notice.png'}));
    expect(image.container.querySelector('img')?.getAttribute('src')).toBe(
      mediaUrl(mediaId(1)),
    );
    expect(screen.queryByRole('button', {name: '재생'})).toBeNull();
    image.unmount();
    const missing = player(mediaItem(2), true);
    expect(missing.media).toBeNull();
    expect(
      screen.getByRole('button', {name: '재생'}).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', {name: '파일 위치 열기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('opens the file location and lets go of the file on unmount', () => {
    const {onReveal, media, unmount} = player(mediaItem(1));
    fireEvent.click(screen.getByRole('button', {name: '파일 위치 열기'}));
    expect(onReveal).toHaveBeenCalledOnce();
    unmount();
    expect(media?.hasAttribute('src')).toBe(false);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });
});
