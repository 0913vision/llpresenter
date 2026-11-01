import {describe, expect, it, vi} from 'vitest';
import type {MediaLayer} from '@core/live/state';
import {installMockClock} from '@fixtures/mockClock';
import {
  BACKGROUND_DISSOLVE_MS,
  SPARE_DELAY_MS,
  type RenderMode,
} from '@renderer/rendering/backgroundLayer';
import {classes} from '@renderer/rendering/classes';
import {
  WARM_LIGHT,
  urlOf,
  setUp,
  isShown,
  playsOf,
} from '@fixtures/renderer/rendering/backgroundLayerFixtures';

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
      const clock = installMockClock();
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
      const clock = installMockClock();
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
      const clock = installMockClock();
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
      const clock = installMockClock();
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
