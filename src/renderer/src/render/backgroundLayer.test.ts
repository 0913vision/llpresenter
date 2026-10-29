import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {MediaLayer} from '@shared/live';
import {installFakeClock} from '../../../../test/fake-clock';
import {
  BACKGROUND_DISSOLVE_MS,
  SPARE_DELAY_MS,
  VIDEO_FRAME_DEADLINE_MS,
  BackgroundLayerView,
  type RenderMode,
  MIN_SEEK_SECONDS,
  startOffsetSeconds,
} from './backgroundLayer';
import {classes} from './classes';

const WARM_LIGHT: MediaLayer = {
  mediaId: 'warm-light',
  loop: true,
  startedAt: Date.now(),
};
const STILL_WATER: MediaLayer = {
  mediaId: 'still-water',
  loop: true,
  startedAt: Date.now(),
};

const urlOf = (mediaId: string): string => `https://media.test/${mediaId}.mp4`;

let readyState: number = HTMLMediaElement.HAVE_ENOUGH_DATA;

beforeEach(() => {
  readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockReturnValue(
    undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(
    () => readyState,
  );
});

function setUp(mode: RenderMode = 'output') {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const view = new BackgroundLayerView(parent, {
    mediaUrl: urlOf,
    onError,
    mode,
  });
  const [first, second] = [...parent.querySelectorAll('video')];
  if (first === undefined || second === undefined) {
    throw new Error('expected two video elements');
  }
  return {parent, view, onError, videos: [first, second] as const};
}

function isShown(element: HTMLElement): boolean {
  return element.classList.contains(classes.shown);
}

function playsOf(video: HTMLVideoElement): number {
  return vi
    .mocked(HTMLMediaElement.prototype.play)
    .mock.contexts.filter(context => context === video).length;
}

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
    const clock = installFakeClock();
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
    const clock = installFakeClock();
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
    const clock = installFakeClock();
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
    readyState = HTMLMediaElement.HAVE_NOTHING;
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
    const clock = installFakeClock();
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

describe('BackgroundLayerView handovers', () => {
  it('restarts a short clip on its own while the spare still holds the last background', () => {
    const {view, videos} = setUp();
    const [older, front] = videos;
    view.show(STILL_WATER);
    front.dispatchEvent(new Event('playing'));
    view.show(WARM_LIGHT);
    older.dispatchEvent(new Event('playing'));
    older.dispatchEvent(new Event('ended'));
    expect(playsOf(older)).toBe(2);
    expect(playsOf(front)).toBe(1);
    expect(front.getAttribute('src')).toBe(urlOf('still-water'));
  });

  it.each<RenderMode>(['output', 'preview'])(
    'holds the last frame of the outgoing background while the next one is slow to start (%s)',
    mode => {
      const {view, videos} = setUp(mode);
      const [incoming, outgoing] = videos;
      view.show(STILL_WATER);
      outgoing.dispatchEvent(new Event('playing'));
      view.show(WARM_LIGHT);
      expect(outgoing.loop).toBe(false);
      outgoing.dispatchEvent(new Event('ended'));
      expect(playsOf(outgoing)).toBe(1);
      expect(playsOf(incoming)).toBe(1);
      incoming.dispatchEvent(new Event('playing'));
      expect(isShown(incoming)).toBe(true);
    },
  );

  it('loops a background that was sought near its end before the spare is ready', async () => {
    const clock = installFakeClock();
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(20);
    const {view, videos} = setUp();
    const [spare, front] = videos;
    view.show({...WARM_LIGHT, startedAt: Date.now() - 19_900});
    front.dispatchEvent(new Event('loadedmetadata'));
    front.dispatchEvent(new Event('playing'));
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(front)).toBe(2);
    expect(playsOf(spare)).toBe(0);
    await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(spare)).toBe(1);
  });
});

describe('BackgroundLayerView rapid changes', () => {
  it('ends a running dissolve before reusing a video for a third background', () => {
    const {view, videos} = setUp();
    const [first, second] = videos;
    view.show(WARM_LIGHT);
    second.dispatchEvent(new Event('playing'));
    view.show(STILL_WATER);
    first.dispatchEvent(new Event('playing'));
    expect(isShown(second)).toBe(true);
    expect(first.classList.contains(classes.dissolving)).toBe(true);

    view.show({mediaId: 'morning-sky', loop: true, startedAt: Date.now()});
    expect(isShown(second)).toBe(false);
    expect(second.getAttribute('src')).toBe(urlOf('morning-sky'));
    expect(isShown(first)).toBe(true);
    expect(first.classList.contains(classes.dissolving)).toBe(false);

    second.dispatchEvent(new Event('playing'));
    expect(isShown(second)).toBe(true);
    expect(second.classList.contains(classes.dissolving)).toBe(true);
    expect(second.style.zIndex).toBe('1');
  });
});

describe('BackgroundLayerView in a preview', () => {
  it('loops on the one video that shows the background and lets the other go', async () => {
    const clock = installFakeClock();
    const {view, videos} = setUp('preview');
    const [spare, front] = videos;
    view.show(WARM_LIGHT);
    expect(front.loop).toBe(true);
    front.dispatchEvent(new Event('playing'));
    await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
    expect(spare.hasAttribute('src')).toBe(false);
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(spare)).toBe(0);
    expect(playsOf(front)).toBe(1);
  });

  it('still dissolves to a new background on the other video', async () => {
    const clock = installFakeClock();
    const {view, videos} = setUp('preview');
    const [older, first] = videos;
    view.show(WARM_LIGHT);
    first.dispatchEvent(new Event('playing'));
    await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
    view.show(STILL_WATER);
    expect(older.getAttribute('src')).toBe(urlOf('still-water'));
    expect(older.loop).toBe(true);
    older.dispatchEvent(new Event('playing'));
    expect(older.classList.contains(classes.dissolving)).toBe(true);
    await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
    expect(first.hasAttribute('src')).toBe(false);
  });

  it('follows a change of the loop setting on the same background', () => {
    const {view, videos} = setUp('preview');
    view.show(WARM_LIGHT);
    videos[1].dispatchEvent(new Event('playing'));
    view.show({...WARM_LIGHT, loop: false});
    expect(videos[1].loop).toBe(false);
  });

  it.each([true, false])(
    'gives a loop change before the next background plays to its video (loop %s)',
    loop => {
      const {view, videos} = setUp('preview');
      const [incoming, outgoing] = videos;
      view.show(STILL_WATER);
      outgoing.dispatchEvent(new Event('playing'));
      view.show({...WARM_LIGHT, loop: !loop});
      view.show({...WARM_LIGHT, loop});
      expect(incoming.loop).toBe(loop);
      expect(outgoing.loop).toBe(false);
      incoming.dispatchEvent(new Event('playing'));
      expect(incoming.loop).toBe(loop);
    },
  );

  it('does not loop the old background when the new one fails to start', () => {
    const {view, videos} = setUp('preview');
    const [incoming, outgoing] = videos;
    view.show(STILL_WATER);
    outgoing.dispatchEvent(new Event('playing'));
    view.show(WARM_LIGHT);
    incoming.dispatchEvent(new Event('error'));
    view.show(WARM_LIGHT);
    expect(outgoing.loop).toBe(false);
    expect(incoming.loop).toBe(false);
  });

  it('never loops natively in an output window', () => {
    const {view, videos} = setUp();
    view.show(WARM_LIGHT);
    expect(videos[1].loop).toBe(false);
  });
});

describe('startOffsetSeconds', () => {
  const STARTED = 1_000_000;
  const DURATION = 20;

  it('wraps the time since the start for a loop', () => {
    const media = {...WARM_LIGHT, startedAt: STARTED};
    expect(startOffsetSeconds(media, DURATION, STARTED + 47_000)).toBe(7);
  });

  it('holds the end of a background that does not loop', () => {
    const media = {...WARM_LIGHT, loop: false, startedAt: STARTED};
    expect(startOffsetSeconds(media, DURATION, STARTED + 47_000)).toBe(20);
  });

  it('starts from the beginning without a duration, or with little time gone', () => {
    const media = {...WARM_LIGHT, startedAt: STARTED};
    expect(startOffsetSeconds(media, DURATION, STARTED)).toBe(0);
    expect(startOffsetSeconds(media, Number.NaN, STARTED + 5000)).toBe(0);
    const justNow = STARTED + MIN_SEEK_SECONDS * 1000 - 1;
    expect(startOffsetSeconds(media, DURATION, justNow)).toBe(0);
  });
});

describe('BackgroundLayerView seeking', () => {
  it('seeks a background that started earlier once its video knows its length', async () => {
    const clock = installFakeClock();
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(20);
    const {view, videos} = setUp();
    view.show({...WARM_LIGHT, startedAt: clock.now().getTime() - 47_000});
    expect(seek).not.toHaveBeenCalled();
    videos[1].dispatchEvent(new Event('loadedmetadata'));
    expect(seek).toHaveBeenCalledWith(7);
    videos[1].dispatchEvent(new Event('loadedmetadata'));
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it('drops a pending seek when the background changes first', () => {
    installFakeClock();
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(20);
    const {view, videos} = setUp();
    view.show({...WARM_LIGHT, startedAt: Date.now() - 47_000});
    view.show(null);
    videos[1].dispatchEvent(new Event('loadedmetadata'));
    expect(seek).not.toHaveBeenCalled();
  });
});

const SUNSET: MediaLayer = {
  mediaId: '7a2d3b9f-4c5e-4f60-9b7c-8d9e0f1a2b3c',
  loop: false,
  startedAt: 0,
};

function refuseVideoSource(video: HTMLVideoElement): void {
  const error = {
    code: 4,
    message: 'The source is an image',
    MEDIA_ERR_ABORTED: 1,
    MEDIA_ERR_NETWORK: 2,
    MEDIA_ERR_DECODE: 3,
    MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
  } satisfies MediaError;
  Object.defineProperty(video, 'error', {configurable: true, value: error});
  video.dispatchEvent(new Event('error'));
}

function incomingImage(parent: HTMLElement): HTMLImageElement {
  const image = parent.querySelector<HTMLImageElement>('img[src]');
  if (image === null) throw new Error('expected an image background');
  return image;
}

describe.each<RenderMode>(['output', 'preview'])(
  'BackgroundLayerView images in %s mode',
  mode => {
    it('shows an image background after decoding it without a video playback error', async () => {
      const clock = installFakeClock();
      const {parent, view, videos, onError} = setUp(mode);
      view.show({...SUNSET, loop: true});
      refuseVideoSource(videos[1]);
      const image = incomingImage(parent);
      expect(image.getAttribute('src')).toBe(urlOf(SUNSET.mediaId));
      expect(isShown(image)).toBe(false);
      image.dispatchEvent(new Event('load'));
      expect(isShown(image)).toBe(true);
      expect(image.classList.contains(classes.dissolving)).toBe(true);
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);

      expect(videos.every(video => !video.hasAttribute('src'))).toBe(true);
      expect(videos.every(video => !video.loop)).toBe(true);
      expect(onError).not.toHaveBeenCalled();
      view.show(null);
      expect(image.hasAttribute('src')).toBe(false);
      expect(isShown(image)).toBe(false);
      view.dispose();
    });

    it('also accepts an image when play rejects before the video error event', async () => {
      vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
        new DOMException('No supported video source', 'NotSupportedError'),
      );
      const {parent, view, videos, onError} = setUp(mode);
      view.show(SUNSET);
      await Promise.resolve();
      const image = incomingImage(parent);
      image.dispatchEvent(new Event('load'));
      videos[1].dispatchEvent(new Event('error'));
      expect(isShown(image)).toBe(true);
      expect(onError).not.toHaveBeenCalled();
      view.dispose();
    });

    it('holds the previous video while the image loads and releases it after the dissolve', async () => {
      const clock = installFakeClock();
      const {parent, view, videos} = setUp(mode);
      view.show(WARM_LIGHT);
      videos[1].dispatchEvent(new Event('playing'));
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
      view.show(SUNSET);
      refuseVideoSource(videos[0]);
      const image = incomingImage(parent);
      expect(isShown(videos[1])).toBe(true);
      expect(isShown(image)).toBe(false);

      image.dispatchEvent(new Event('load'));
      expect(image.style.zIndex).toBe('1');
      expect(videos[1].style.zIndex).toBe('0');
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
      expect(videos[1].hasAttribute('src')).toBe(false);
      expect(isShown(videos[1])).toBe(false);
      view.dispose();
    });

    it('keeps the same image and then dissolves from it to a video', async () => {
      const clock = installFakeClock();
      const {parent, view, videos} = setUp(mode);
      view.show(SUNSET);
      refuseVideoSource(videos[1]);
      const image = incomingImage(parent);
      image.dispatchEvent(new Event('load'));
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
      view.show({...SUNSET});
      expect(incomingImage(parent)).toBe(image);
      expect(playsOf(videos[1])).toBe(1);

      view.show(WARM_LIGHT);
      expect(isShown(image)).toBe(true);
      videos[0].dispatchEvent(new Event('playing'));
      expect(isShown(videos[0])).toBe(true);
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
      expect(image.hasAttribute('src')).toBe(false);
      expect(isShown(image)).toBe(false);
      view.dispose();
    });

    it('clears the image and ignores a late load or error from the cancelled source', () => {
      const {parent, view, videos, onError} = setUp(mode);
      view.show(SUNSET);
      refuseVideoSource(videos[1]);
      const image = incomingImage(parent);
      view.show(null);
      image.dispatchEvent(new Event('load'));
      image.dispatchEvent(new Event('error'));
      expect(image.hasAttribute('src')).toBe(false);
      expect(isShown(image)).toBe(false);
      expect(onError).not.toHaveBeenCalled();
      view.dispose();
    });

    it('keeps the last good picture and reports a source that neither decoder accepts', () => {
      const {parent, view, videos, onError} = setUp(mode);
      view.show(WARM_LIGHT);
      videos[1].dispatchEvent(new Event('playing'));
      view.show(SUNSET);
      refuseVideoSource(videos[0]);
      const image = incomingImage(parent);
      image.dispatchEvent(new Event('error'));
      expect(isShown(videos[1])).toBe(true);
      expect(isShown(image)).toBe(false);
      expect(onError).toHaveBeenCalledOnce();
      view.dispose();
    });

    it('releases images and listeners when disposed while a source is loading', () => {
      const {parent, view, videos, onError} = setUp(mode);
      view.show(SUNSET);
      refuseVideoSource(videos[1]);
      const image = incomingImage(parent);
      view.dispose();
      image.dispatchEvent(new Event('load'));
      image.dispatchEvent(new Event('error'));
      expect(parent.childElementCount).toBe(0);
      expect(image.hasAttribute('src')).toBe(false);
      expect(onError).not.toHaveBeenCalled();
    });

    it('dissolves between still images with a fixed pair of image elements', async () => {
      const clock = installFakeClock();
      const {parent, view, videos} = setUp(mode);
      view.show(SUNSET);
      refuseVideoSource(videos[1]);
      const previous = incomingImage(parent);
      previous.dispatchEvent(new Event('load'));
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);

      const nextId = 'morning-image';
      view.show({...SUNSET, mediaId: nextId});
      refuseVideoSource(videos[0]);
      const next = parent.querySelector<HTMLImageElement>(
        `img[src="${urlOf(nextId)}"]`,
      );
      if (next === null) throw new Error('expected the next still image');
      expect(isShown(previous)).toBe(true);
      next.dispatchEvent(new Event('load'));
      await clock.advance(BACKGROUND_DISSOLVE_MS + SPARE_DELAY_MS);
      expect(isShown(next)).toBe(true);
      expect(previous.hasAttribute('src')).toBe(false);
      expect(parent.querySelectorAll('img')).toHaveLength(2);
      view.dispose();
    });

    it('ignores events from an image replaced by a newer background before it loads', () => {
      const {parent, view, videos, onError} = setUp(mode);
      view.show(SUNSET);
      refuseVideoSource(videos[1]);
      const oldImage = incomingImage(parent);
      view.show(WARM_LIGHT);
      oldImage.dispatchEvent(new Event('load'));
      oldImage.dispatchEvent(new Event('error'));
      expect(isShown(oldImage)).toBe(false);
      expect(onError).not.toHaveBeenCalled();
      videos[1].dispatchEvent(new Event('playing'));
      expect(isShown(videos[1])).toBe(true);
      view.dispose();
    });
  },
);
