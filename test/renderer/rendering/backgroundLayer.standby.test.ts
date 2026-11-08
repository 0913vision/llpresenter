import {describe, expect, it, vi} from 'vitest';
import {
  isShown,
  playsOf,
  setUp,
  STILL_WATER,
  WARM_LIGHT,
} from '@fixtures/renderer/rendering/backgroundLayerFixtures';

describe('background standby', () => {
  it('prepares one paused frame without playback or a loop spare', () => {
    vi.useFakeTimers();
    const {view, videos} = setUp();
    try {
      view.show(WARM_LIGHT, false, true);
      expect(view.ready()).toBe(false);
      videos[1].dispatchEvent(new Event('loadeddata'));
      expect(view.ready()).toBe(true);
      expect(isShown(videos[1])).toBe(true);
      vi.advanceTimersByTime(5000);
      expect(playsOf(videos[0]) + playsOf(videos[1])).toBe(0);
      expect(videos[0].hasAttribute('src')).toBe(false);
      expect(videos[1].muted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      view.dispose();
      vi.useRealTimers();
    }
  });

  it.each([
    [35_000, 11],
    [250, 0.25],
  ])(
    'resumes the prepared decoder after %i ms at %f seconds',
    (elapsed, offset) => {
      const {view, videos} = setUp();
      const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
      try {
        Object.defineProperty(videos[1], 'duration', {value: 12});
        view.show(WARM_LIGHT, false, true);
        videos[1].dispatchEvent(new Event('loadeddata'));
        const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls
          .length;
        vi.spyOn(Date, 'now').mockReturnValue(WARM_LIGHT.startedAt + elapsed);
        view.show(WARM_LIGHT, false);
        expect(view.ready()).toBe(false);
        expect(
          vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length,
        ).toBe(loads);
        expect(seek).toHaveBeenLastCalledWith(offset);
        expect(playsOf(videos[1])).toBe(1);
        videos[1].dispatchEvent(new Event('playing'));
        expect(view.ready()).toBe(true);
        expect(isShown(videos[1])).toBe(true);
      } finally {
        view.dispose();
      }
    },
  );

  it('holds a finished nonlooping video at the end instead of restarting it', () => {
    const {view, videos} = setUp();
    const seek = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    const media = {...WARM_LIGHT, loop: false};
    try {
      Object.defineProperty(videos[1], 'duration', {value: 12});
      view.show(media, false, true);
      videos[1].dispatchEvent(new Event('loadeddata'));
      vi.spyOn(Date, 'now').mockReturnValue(media.startedAt + 35_000);
      view.show(media, false);
      videos[1].dispatchEvent(new Event('seeked'));
      expect(seek).toHaveBeenLastCalledWith(12);
      expect(playsOf(videos[1])).toBe(0);
      expect(view.ready()).toBe(true);
      expect(isShown(videos[1])).toBe(true);
    } finally {
      view.dispose();
    }
  });

  it('replaces hidden media and ignores readiness from the released source', () => {
    const {view, videos} = setUp();
    try {
      view.show(WARM_LIGHT, false, true);
      videos[1].dispatchEvent(new Event('loadeddata'));
      view.show(STILL_WATER, false, true);
      expect(videos[1].hasAttribute('src')).toBe(false);
      videos[1].dispatchEvent(new Event('loadeddata'));
      expect(view.ready()).toBe(false);
      videos[0].dispatchEvent(new Event('loadeddata'));
      expect(view.ready()).toBe(true);
      expect(playsOf(videos[0]) + playsOf(videos[1])).toBe(0);
    } finally {
      view.dispose();
    }
    expect(videos.every(video => !video.hasAttribute('src'))).toBe(true);
  });

  it('pauses a playing output and cancels pending loop work when disabled', () => {
    vi.useFakeTimers();
    const {view, videos} = setUp();
    try {
      view.show(WARM_LIGHT, false);
      videos[1].dispatchEvent(new Event('playing'));
      view.show(WARM_LIGHT, false, true);
      const loads = vi.mocked(HTMLMediaElement.prototype.load).mock.calls
        .length;
      vi.advanceTimersByTime(5000);
      expect(vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length).toBe(
        loads,
      );
      expect(videos[0].hasAttribute('src')).toBe(false);
      expect(view.ready()).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      view.dispose();
      vi.useRealTimers();
    }
  });
});
