import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {
  BACKGROUND_DISSOLVE_MS,
  BACKGROUND_RELEASE_DELAY_MS,
  type RenderMode,
  MIN_SEEK_SECONDS,
  startOffsetSeconds,
} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';
import {
  WARM_LIGHT,
  STILL_WATER,
  urlOf,
  setUp,
  isShown,
  playsOf,
} from '@fixtures/renderer/rendering/backgroundLayerFixtures';

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

  it.each<RenderMode>(['output'])(
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

  it('loops a background sought near its end without preloading another decoder', async () => {
    const clock = installMockClock();
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(20);
    const {view, videos} = setUp();
    const [spare, front] = videos;
    view.show({...WARM_LIGHT, startedAt: Date.now() - 19_900});
    front.dispatchEvent(new Event('loadedmetadata'));
    front.dispatchEvent(new Event('playing'));
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(front)).toBe(2);
    expect(playsOf(spare)).toBe(0);
    await clock.advance(BACKGROUND_DISSOLVE_MS + BACKGROUND_RELEASE_DELAY_MS);
    front.dispatchEvent(new Event('ended'));
    expect(playsOf(spare)).toBe(0);
    expect(spare.hasAttribute('src')).toBe(false);
    expect(front.loop).toBe(true);
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
    const clock = installMockClock();
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
    installMockClock();
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(20);
    const {view, videos} = setUp();
    view.show({...WARM_LIGHT, startedAt: Date.now() - 47_000});
    view.show(null);
    videos[1].dispatchEvent(new Event('loadedmetadata'));
    expect(seek).not.toHaveBeenCalled();
  });
  // NOTE(0913vision): Spec 08, "What must never happen during a service": a
  // missing or broken background file never turns the output black.
  it('keeps the last frame shown when the playing background fails', () => {
    const {view, videos, onError} = setUp();
    const front = videos[1];
    view.show(STILL_WATER);
    front.dispatchEvent(new Event('playing'));
    expect(isShown(front)).toBe(true);

    front.dispatchEvent(new Event('error'));

    expect(isShown(front)).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
  });
});
