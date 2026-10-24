import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {MediaLayer} from '@shared/live';
import {installFakeClock} from '../../../../test/fake-clock';
import {
  BACKGROUND_DISSOLVE_MS,
  BackgroundLayerView,
  MIN_SEEK_SECONDS,
  startOffsetSeconds,
} from './backgroundLayer';
import {classes} from './classes';

const WARM_LIGHT: MediaLayer = {mediaId: 'warm-light', loop: true};
const STILL_WATER: MediaLayer = {mediaId: 'still-water', loop: true};

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

function setUp() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const view = new BackgroundLayerView(parent, {mediaUrl: urlOf, onError});
  const [first, second] = [...parent.querySelectorAll('video')];
  if (first === undefined || second === undefined) {
    throw new Error('expected two video elements');
  }
  return {parent, view, onError, videos: [first, second] as const};
}

function isShown(video: HTMLVideoElement): boolean {
  return video.classList.contains(classes.shown);
}

function playsOf(video: HTMLVideoElement): number {
  return vi
    .mocked(HTMLMediaElement.prototype.play)
    .mock.contexts.filter(context => context === video).length;
}

describe('BackgroundLayerView', () => {
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

  it('loads the same background into the other video after the dissolve, for the loop', async () => {
    const clock = installFakeClock();
    const {view, videos} = setUp();
    const [spare, front] = videos;
    view.show(WARM_LIGHT);
    front.dispatchEvent(new Event('playing'));
    await clock.advance(BACKGROUND_DISSOLVE_MS);
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
    await clock.advance(BACKGROUND_DISSOLVE_MS);

    front.dispatchEvent(new Event('ended'));
    expect(playsOf(spare)).toBe(1);
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

  it('holds the last frame of the outgoing background while the next one is slow to start', () => {
    const {view, videos} = setUp();
    const [incoming, outgoing] = videos;
    view.show(STILL_WATER);
    outgoing.dispatchEvent(new Event('playing'));
    view.show(WARM_LIGHT);
    outgoing.dispatchEvent(new Event('ended'));
    expect(playsOf(outgoing)).toBe(1);
    expect(playsOf(incoming)).toBe(1);
    incoming.dispatchEvent(new Event('playing'));
    expect(isShown(incoming)).toBe(true);
  });

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
    await clock.advance(BACKGROUND_DISSOLVE_MS);
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

    view.show({mediaId: 'morning-sky', loop: true});
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

  it('starts from the beginning without a start time, a duration, or much time gone', () => {
    expect(startOffsetSeconds(WARM_LIGHT, DURATION, STARTED)).toBe(0);
    const media = {...WARM_LIGHT, startedAt: STARTED};
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
