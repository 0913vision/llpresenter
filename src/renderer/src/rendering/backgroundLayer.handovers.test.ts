import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '../../../../test/mock-clock';
import {
  BACKGROUND_DISSOLVE_MS,
  SPARE_DELAY_MS,
  type RenderMode,
  MIN_SEEK_SECONDS,
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
} from './testing/backgroundLayerFixtures';

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
    const clock = installMockClock();
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
    const clock = installMockClock();
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
});
