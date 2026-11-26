import {expect, it, vi} from 'vitest';
import {
  WARM_LIGHT,
  isShown,
  playsOf,
  setUp,
} from '@fixtures/renderer/rendering/backgroundLayerFixtures';

function pausesOf(video: HTMLVideoElement): number {
  return vi
    .mocked(HTMLMediaElement.prototype.pause)
    .mock.contexts.filter(context => context === video).length;
}

it('holds a playing background still while its output stands by, and plays on when it comes back', () => {
  const {view, videos} = setUp();
  const [, front] = videos;
  view.show(WARM_LIGHT);
  front.dispatchEvent(new Event('playing'));
  expect(playsOf(front)).toBe(1);

  view.show(WARM_LIGHT, true);
  expect(pausesOf(front)).toBeGreaterThan(0);
  expect(isShown(front)).toBe(true);

  view.show(WARM_LIGHT, false);
  expect(playsOf(front)).toBe(2);
});

it('starts a new background on stand by without playing it, showing its first picture', () => {
  const {view, videos} = setUp();
  const [, front] = videos;
  view.show(WARM_LIGHT, true);
  expect(playsOf(front)).toBe(0);
  front.dispatchEvent(new Event('loadeddata'));
  front.dispatchEvent(new Event('seeked'));
  expect(playsOf(front)).toBe(0);
});
