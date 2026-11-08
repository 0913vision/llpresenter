import {afterEach, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {SlidePreviewPlayback} from '@renderer/features/songs/editor/slidePreviewPlayback';
import {classes} from '@renderer/rendering/classes';
import type {RenderFrame} from '@renderer/rendering/layer';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';

afterEach(() => vi.useRealTimers());

it('immediately cancels a running four-second preview wipe when the operator chooses none', () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    textStyle: DEFAULT_TEXT_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    mode: 'preview',
    onError,
  });
  const preview = new SlidePreviewPlayback((layers, frame) =>
    renderer.render(layers, frame),
  );
  const cancel = vi.fn();
  const animate = vi.fn(() => ({cancel}));
  for (const page of parent.querySelectorAll(`.${classes.page}`)) {
    Object.defineProperty(page, 'animate', {value: animate});
  }
  const layers = {
    ...emptyLayers(),
    slide: {itemId: 'local', position: 1, label: null, lines: ['New']},
  };
  const before = {
    ...layers,
    slide: {...layers.slide, position: 0, lines: ['Old']},
  };
  const cut: RenderFrame = {
    transitions: true,
    slide: layers.slide,
    slideTransition: {kind: 'none', sec: 4},
  };
  try {
    preview.render(layers, cut, before);
    preview.render(
      layers,
      {...cut, slideTransition: {kind: 'wipe', dir: 'left', sec: 4}},
      before,
    );
    vi.advanceTimersByTime(32);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenLastCalledWith(expect.any(Array), {
      duration: 4000,
      easing: 'linear',
    });
    expect(cancel).not.toHaveBeenCalled();
    preview.render(layers, cut, before);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(
      parent.querySelector(`[data-layer="lyrics"] .${classes.shown}`)
        ?.textContent,
    ).toBe('New');
    vi.advanceTimersByTime(4000);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  } finally {
    preview.dispose();
    renderer.dispose();
  }
});
