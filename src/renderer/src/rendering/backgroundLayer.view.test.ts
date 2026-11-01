import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '../../../../test/mock-clock';
import {
  BACKGROUND_DISSOLVE_MS,
  SPARE_DELAY_MS,
  VIDEO_FRAME_DEADLINE_MS,
  BackgroundLayerView,
  startOffsetSeconds,
} from './backgroundLayer';
import {classes} from './classes';
import {
  WARM_LIGHT,
  STILL_WATER,
  urlOf,
  setUp,
  isShown,
  playsOf,
  setReadyState,
} from './testing/backgroundLayerFixtures';

describe('BackgroundLayerView', () => {
  it('holds a cleared video and reloads the same media at its restored clock position', () => {
    const {view, videos} = setUp();
    view.show(WARM_LIGHT, false);
    videos[1].dispatchEvent(new Event('playing'));
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    view.hold();
    expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.contexts).toContain(
      videos[1],
    );
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    play.mockClear();
    videos[1].dispatchEvent(new Event('ended'));
    expect(play).not.toHaveBeenCalled();
    const load = vi.mocked(HTMLMediaElement.prototype.load);
    load.mockClear();
    view.show({...WARM_LIGHT, startedAt: Date.now()}, false);
    expect(load).toHaveBeenCalled();
    expect(play).toHaveBeenCalled();
    view.dispose();
  });
  it('bounds a hidden video frame callback and releases its callback and deadline', async () => {
    const clock = installMockClock();
    const {view, videos} = setUp();
    const video = videos[1];
    const cancel = vi.fn();
    Object.defineProperty(video, 'requestVideoFrameCallback', {
      value: vi.fn(() => 7),
    });
    Object.defineProperty(video, 'cancelVideoFrameCallback', {value: cancel});
    view.show(WARM_LIGHT, false);
    video.dispatchEvent(new Event('playing'));
    expect(view.ready()).toBe(false);
    await clock.advance(VIDEO_FRAME_DEADLINE_MS);
    expect(view.ready()).toBe(true);
    expect(cancel).toHaveBeenCalledWith(7);
    view.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('makes a failed replacement ready with the last good background and resets on the next source', () => {
    const {view, videos, onError} = setUp();
    view.show(WARM_LIGHT, false);
    videos[1].dispatchEvent(new Event('playing'));
    expect(view.ready()).toBe(true);
    view.show(STILL_WATER, false);
    expect(view.ready()).toBe(false);
    videos[0].dispatchEvent(new Event('error'));
    expect(view.ready()).toBe(true);
    expect(isShown(videos[1])).toBe(true);
    expect(videos[0].hasAttribute('src')).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    view.show({...STILL_WATER, mediaId: 'next'});
    expect(view.ready()).toBe(false);
    view.dispose();
  });

  it('waits for a decoded frame and makes hidden/reveal backgrounds instant', () => {
    const {view, videos} = setUp();
    const video = videos[1];
    let decoded = (): void => {};
    const cancel = vi.fn();
    Object.defineProperty(video, 'requestVideoFrameCallback', {
      value: (callback: VideoFrameRequestCallback) => {
        decoded = () =>
          callback(0, {
            width: 1920,
            height: 1080,
            mediaTime: 0,
            presentationTime: 0,
            expectedDisplayTime: 0,
            presentedFrames: 1,
            processingDuration: 0,
          });
        return 1;
      },
    });
    Object.defineProperty(video, 'cancelVideoFrameCallback', {value: cancel});
    view.show(WARM_LIGHT, false);
    expect(view.ready()).toBe(false);
    video.dispatchEvent(new Event('playing'));
    expect(view.ready()).toBe(false);
    expect(video.classList.contains(classes.dissolving)).toBe(false);
    decoded();
    expect(view.ready()).toBe(true);
    const plays = playsOf(video);
    view.show({...WARM_LIGHT}, false);
    expect(playsOf(video)).toBe(plays);
    view.show(STILL_WATER, true);
    videos[0].dispatchEvent(new Event('playing'));
    expect(videos[0].classList.contains(classes.dissolving)).toBe(true);
    view.dispose();
  });
  it.each([
    ['fit', 'contain'],
    ['fill', 'cover'],
    ['stretch', 'fill'],
  ] as const)(
    'applies %s to both images and videos without restarting the same background',
    (fit, objectFit) => {
      const {parent, view, videos} = setUp();
      view.show(WARM_LIGHT);
      videos[1].dispatchEvent(new Event('playing'));
      const properties = {speed: 2, fit, volume: 35, audio: true};
      view.show({...WARM_LIGHT, properties});
      expect(videos[1].playbackRate).toBe(2);
      expect(videos[1].volume).toBe(0.35);
      expect(videos[1].muted).toBe(true);
      expect(playsOf(videos[1])).toBe(1);
      expect(videos[1].style.objectFit).toBe(objectFit);
      expect(
        [...parent.querySelectorAll('img')].some(
          image => image.style.objectFit === objectFit,
        ),
      ).toBe(true);
      view.dispose();
    },
  );
  it('joins the rate-adjusted position and keeps previews muted even when service sound is allowed', () => {
    const parent = document.createElement('div');
    const view = new BackgroundLayerView(parent, {
      mediaUrl: urlOf,
      onError: vi.fn(),
      mode: 'preview',
      muted: false,
    });
    const media = {
      ...WARM_LIGHT,
      properties: {speed: 2, fit: 'fit' as const, volume: 40, audio: true},
      positionSeconds: 3,
      startedAt: 1000,
    };
    expect(startOffsetSeconds(media, 100, 3000)).toBe(7);
    view.show(media);
    expect(
      [...parent.querySelectorAll('video')].every(video => video.muted),
    ).toBe(true);
    view.dispose();
  });
  it('starts a background on the spare and dissolves it in once it plays', () => {
    const {view, videos} = setUp();
    view.show(WARM_LIGHT);
    const [, incoming] = videos;
    expect(incoming.getAttribute('src')).toBe(urlOf('warm-light'));
    expect(playsOf(incoming)).toBe(1);
    expect(isShown(incoming)).toBe(false);

    incoming.dispatchEvent(new Event('playing'));
    expect(isShown(incoming)).toBe(true);
    expect(incoming.classList.contains(classes.dissolving)).toBe(true);
  });

  it('loads the same background into the other video a while after the dissolve, for the loop', async () => {
    const clock = installMockClock();
    const {view, videos} = setUp();
    const [spare, front] = videos;
    view.show(WARM_LIGHT);
    front.dispatchEvent(new Event('playing'));
    await clock.advance(BACKGROUND_DISSOLVE_MS);
    expect(spare.getAttribute('src')).not.toBe(urlOf('warm-light'));
    await clock.advance(SPARE_DELAY_MS);
    expect(spare.getAttribute('src')).toBe(urlOf('warm-light'));
    expect(isShown(spare)).toBe(false);
    expect(playsOf(spare)).toBe(0);
  });

  it('hands a looping background over to the spare when it ends, without a gap', async () => {
    const clock = installMockClock();
    const {view, videos} = setUp();
    const [spare, front] = videos;
    view.show(WARM_LIGHT);
    front.dispatchEvent(new Event('playing'));
    await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);

    front.dispatchEvent(new Event('ended'));
    expect(playsOf(spare)).toBe(1);
    view.show({...WARM_LIGHT});
    expect(isShown(front)).toBe(true);
    spare.dispatchEvent(new Event('playing'));
    expect(isShown(spare)).toBe(true);
    expect(spare.classList.contains(classes.dissolving)).toBe(false);
    expect(isShown(front)).toBe(false);

    spare.dispatchEvent(new Event('ended'));
    expect(playsOf(front)).toBe(2);
  });

  it('restarts the front video when the spare is not ready at the loop point', () => {
    const {view, videos} = setUp();
    const [, front] = videos;
    view.show(WARM_LIGHT);
    front.dispatchEvent(new Event('playing'));
    setReadyState(HTMLMediaElement.HAVE_NOTHING);
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(front)).toBe(2);
  });

  it('holds the last frame of a background that does not loop', () => {
    const {view, videos} = setUp();
    const [spare, front] = videos;
    view.show({...WARM_LIGHT, loop: false});
    front.dispatchEvent(new Event('playing'));
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(spare)).toBe(0);
    expect(playsOf(front)).toBe(1);
    expect(isShown(front)).toBe(true);
  });

  it('keeps playing when the same background is shown again', () => {
    const {view, videos} = setUp();
    view.show(WARM_LIGHT);
    view.show({...WARM_LIGHT});
    expect(playsOf(videos[1])).toBe(1);
    expect(playsOf(videos[0])).toBe(0);
  });

  it('switches to a new background on the other video', () => {
    const {view, videos} = setUp();
    const [older, first] = videos;
    view.show(WARM_LIGHT);
    first.dispatchEvent(new Event('playing'));
    view.show(STILL_WATER);
    expect(older.getAttribute('src')).toBe(urlOf('still-water'));
    older.dispatchEvent(new Event('playing'));
    expect(isShown(older)).toBe(true);
    expect(older.style.zIndex).toBe('1');
    expect(first.style.zIndex).toBe('0');
  });

  it('clears at once and gives the decoders back', () => {
    const {view, videos} = setUp();
    view.show(WARM_LIGHT);
    videos[1].dispatchEvent(new Event('playing'));
    view.show(null);
    for (const video of videos) {
      expect(isShown(video)).toBe(false);
      expect(video.hasAttribute('src')).toBe(false);
    }
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });

  it('reports a video that cannot play and keeps the picture', () => {
    const {view, videos, onError} = setUp();
    view.show(WARM_LIGHT);
    videos[1].dispatchEvent(new Event('playing'));
    view.show(STILL_WATER);
    videos[0].dispatchEvent(new Event('error'));
    videos[0].dispatchEvent(new Event('playing'));
    expect(onError).toHaveBeenCalledWith(
      'could not play a background video',
      expect.objectContaining({src: urlOf('still-water')}),
    );
    expect(isShown(videos[1])).toBe(true);
    expect(isShown(videos[0])).toBe(false);
  });

  it('reports a refused play', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new Error('NotAllowedError'),
    );
    const {view, onError} = setUp();
    view.show(WARM_LIGHT);
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'could not start a background video',
        expect.any(Error),
      );
    });
  });

  it('says nothing when its own pause or source change interrupts a play', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('The play() request was interrupted', 'AbortError'),
    );
    const {view, onError} = setUp();
    view.show(WARM_LIGHT);
    view.show(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });

  it('stops listening, unloads its videos, and removes itself on dispose', async () => {
    const clock = installMockClock();
    const {parent, view, videos} = setUp();
    view.show(WARM_LIGHT);
    videos[1].dispatchEvent(new Event('playing'));
    view.dispose();
    await clock.runAll();
    videos[1].dispatchEvent(new Event('ended'));
    expect(playsOf(videos[0])).toBe(0);
    expect(parent.childElementCount).toBe(0);
    expect(videos[0].hasAttribute('src')).toBe(false);
  });
});
