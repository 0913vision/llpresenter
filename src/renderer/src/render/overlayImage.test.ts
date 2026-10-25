import {describe, expect, it, vi} from 'vitest';
import {classes} from './classes';
import {OverlayImageView} from './overlayImage';

function setUp() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const mediaUrl = vi.fn((id: string) => `https://media.test/${id}`);
  const view = new OverlayImageView(parent, {onError, mediaUrl});
  const images = [...parent.querySelectorAll('img')];
  for (const image of images) image.decode = vi.fn(() => Promise.resolve());
  const loading = (id: string) => {
    const image = images.find(item => item.src === mediaUrl(id));
    if (image === undefined) throw new Error(`No pending image ${id}`);
    return image;
  };
  const loaded = async (id: string) => {
    const image = loading(id);
    image.dispatchEvent(new Event('load'));
    await Promise.resolve();
    return image;
  };
  return {parent, view, images, loading, loaded, onError, mediaUrl};
}

describe('OverlayImageView', () => {
  it('keeps the decoded picture until its replacement is ready and preserves transparency', async () => {
    const {view, images, loaded, loading} = setUp();
    view.show('first');
    const first = await loaded('first');
    view.show('second');
    expect(first.hidden).toBe(false);
    expect(loading('second').hidden).toBe(true);
    const second = await loaded('second');
    expect(second.hidden).toBe(false);
    expect(first.hidden).toBe(true);
    expect(first.getAttribute('src')).toBeNull();
    expect(
      images.every(image => image.classList.contains(classes.overlayImage)),
    ).toBe(true);
    expect(
      images.every(image => !image.classList.contains(classes.image)),
    ).toBe(true);
    view.dispose();
  });

  it('keeps exactly two image elements through repeated changes and unloads them on clear', async () => {
    const {parent, view, images, loaded} = setUp();
    for (let change = 0; change < 30; change += 1) {
      view.show(`image-${change}`);
      await loaded(`image-${change}`);
    }
    expect([...parent.querySelectorAll('img')]).toEqual(images);
    view.show(null);
    for (const image of images) {
      expect(image.hidden).toBe(true);
      expect(image.getAttribute('src')).toBeNull();
    }
    view.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('ignores a stale decode and a decode finishing after disposal', async () => {
    const {parent, view, loading, loaded, onError} = setUp();
    let finish: () => void = () => undefined;
    view.show('old');
    const old = loading('old');
    old.decode = () =>
      new Promise<void>(resolve => {
        finish = resolve;
      });
    old.dispatchEvent(new Event('load'));
    view.show('new');
    old.decode = () => Promise.resolve();
    const next = await loaded('new');
    finish();
    await Promise.resolve();
    expect(next.hidden).toBe(false);
    expect(next.src).toBe('https://media.test/new');
    view.show('pending');
    const pending = loading('pending');
    pending.decode = () =>
      new Promise<void>(resolve => {
        finish = resolve;
      });
    pending.dispatchEvent(new Event('load'));
    view.dispose();
    view.show('after-dispose');
    finish();
    await Promise.resolve();
    expect(parent.children).toHaveLength(0);
    expect(pending.getAttribute('src')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('logs a failed replacement once and keeps the last good picture', async () => {
    const {view, loaded, loading, onError, mediaUrl} = setUp();
    view.show('good');
    const good = await loaded('good');
    view.show('broken');
    loading('broken').dispatchEvent(new Event('error'));
    mediaUrl.mockClear();
    for (let attempt = 0; attempt < 10; attempt += 1) view.show('broken');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(mediaUrl).not.toHaveBeenCalled();
    expect(good.hidden).toBe(false);
    view.dispose();
  });
});
