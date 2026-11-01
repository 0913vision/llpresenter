import {describe, expect, it, vi} from 'vitest';
import {loadBackgroundImage} from '@renderer/rendering/backgroundImage';

function setUp() {
  const image = document.createElement('img');
  const onReady = vi.fn();
  const onError = vi.fn();
  const cancel = loadBackgroundImage(image, {
    src: 'https://media.test/sunset.png',
    onReady,
    onError,
  });
  return {image, onReady, onError, cancel};
}

describe('loadBackgroundImage', () => {
  it('starts loading the source and reports a load once', () => {
    const {image, onReady, onError} = setUp();
    expect(image.getAttribute('src')).toBe('https://media.test/sunset.png');
    image.dispatchEvent(new Event('load'));
    image.dispatchEvent(new Event('load'));
    expect(onReady).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a failed load once and ignores a load after it', () => {
    const {image, onReady, onError} = setUp();
    image.dispatchEvent(new Event('error'));
    image.dispatchEvent(new Event('error'));
    image.dispatchEvent(new Event('load'));
    expect(onError).toHaveBeenCalledOnce();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('unloads the source and ignores events after it is cancelled', () => {
    const {image, onReady, onError, cancel} = setUp();
    cancel();
    expect(image.hasAttribute('src')).toBe(false);
    image.dispatchEvent(new Event('load'));
    image.dispatchEvent(new Event('error'));
    expect(onReady).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
