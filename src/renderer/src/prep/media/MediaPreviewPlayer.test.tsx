import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
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
