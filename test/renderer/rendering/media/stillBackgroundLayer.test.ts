import {afterEach, expect, it, vi} from 'vitest';
import type {MediaLayer} from '@core/schema/live/live';
import {StillBackgroundLayerView} from '@renderer/rendering/media/stillBackgroundLayer';
import type {PreviewMediaSource} from '@renderer/rendering/media/previewMedia';

const PICTURE = '00000000-0000-4000-8000-000000000601';
const OTHER = '00000000-0000-4000-8000-000000000602';

afterEach(() => {
  document.body.replaceChildren();
});

function layer(mediaId: string, fit?: 'fit' | 'fill'): MediaLayer {
  return {
    mediaId,
    loop: false,
    startedAt: 0,
    ...(fit === undefined
      ? {}
      : {properties: {speed: 1, fit, volume: 100, audio: true}}),
  };
}

function setup(source: Partial<PreviewMediaSource> = {}) {
  const onError = vi.fn();
  const previewMedia: PreviewMediaSource = {
    peek: () => undefined,
    url: () => new Promise(() => undefined),
    remaining: () => undefined,
    ...source,
  };
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new StillBackgroundLayerView(parent, {
    mediaUrl: id => `llp-media://media/${id}`,
    previewMedia,
    onError,
  });
  const image = parent.querySelector('img');
  if (image === null) throw new Error('No image');
  return {view, image, onError};
}

it('draws a picture this window knows at once, fitted as its properties say', () => {
  const {view, image} = setup({peek: id => `known://${id}`});
  view.show(layer(PICTURE, 'fit'));
  expect(image.getAttribute('src')).toBe(`known://${PICTURE}`);
  expect(image.style.objectFit).toBe('contain');
});

it('waits for a picture it has to ask for, and draws it once it comes', async () => {
  let answer: (url: string) => void = () => undefined;
  const {view, image} = setup({
    url: () =>
      new Promise(resolve => {
        answer = resolve;
      }),
  });
  view.show(layer(PICTURE));
  expect(view.ready()).toBe(false);
  expect(image.getAttribute('src')).toBeNull();
  answer(`asked://${PICTURE}`);
  await vi.waitFor(() =>
    expect(image.getAttribute('src')).toBe(`asked://${PICTURE}`),
  );
});

it('says why a picture could not be read, and forgets one that was replaced meanwhile', async () => {
  const {view, image, onError} = setup({
    url: id =>
      id === PICTURE
        ? Promise.reject(new Error('gone'))
        : new Promise(() => undefined),
  });
  view.show(layer(PICTURE));
  await vi.waitFor(() =>
    expect(onError).toHaveBeenCalledWith('could not load a preview picture', {
      mediaId: PICTURE,
    }),
  );
  expect(view.ready()).toBe(true);
  expect(image.getAttribute('src')).toBeNull();

  const later = setup({peek: id => `known://${id}`});
  later.view.show(layer(PICTURE));
  later.view.show(layer(OTHER));
  later.image.dispatchEvent(new Event('error'));
  expect(later.onError).toHaveBeenCalledWith(
    'could not load a preview picture',
    {
      mediaId: OTHER,
    },
  );
});

it('clears the picture for no media, and goes with its element', () => {
  const {view, image} = setup({peek: id => `known://${id}`});
  view.show(layer(PICTURE));
  view.show(null);
  expect(image.getAttribute('src')).toBeNull();
  expect(view.moveTo()).toBe(false);
  view.dispose();
  expect(document.body.querySelector('img')).toBeNull();
});

it('reads the time left of a still from the media list', () => {
  const remaining = vi.fn(() => 12);
  const {view} = setup({peek: id => `known://${id}`, remaining});
  expect(view.remaining()).toBeUndefined();
  view.show(layer(PICTURE));
  expect(view.remaining()).toBe(12);
});
