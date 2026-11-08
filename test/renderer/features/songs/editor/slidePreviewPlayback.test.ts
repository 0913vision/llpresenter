import {afterEach, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import type {RenderFrame} from '@renderer/rendering/layer';
import {SlidePreviewPlayback} from '@renderer/features/songs/editor/slidePreviewPlayback';

afterEach(() => vi.useRealTimers());

it('replays a changed effect once from the previous slide and cancels superseded work', () => {
  vi.useFakeTimers();
  const draw = vi.fn<(layers: LiveLayers, frame: RenderFrame) => void>();
  const preview = new SlidePreviewPlayback(draw);
  const layers = {
    ...emptyLayers(),
    slide: {itemId: 'local', position: 1, label: null, lines: ['New']},
  };
  const before = {
    ...layers,
    slide: {...layers.slide, position: 0, lines: ['Old']},
  };
  const initial: RenderFrame = {
    slide: layers.slide,
    slideTransition: {kind: 'none', sec: 0.5},
  };
  preview.render(layers, initial, before);
  const wipe: RenderFrame = {
    ...initial,
    slideTransition: {kind: 'wipe', dir: 'left', sec: 4},
  };
  preview.render(layers, wipe, before);
  expect(draw).toHaveBeenLastCalledWith(
    before,
    expect.objectContaining({transitions: false, slide: before.slide}),
  );
  preview.render(layers, {...wipe}, before);
  expect(draw).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(32);
  expect(draw).toHaveBeenLastCalledWith(layers, wipe);
  preview.render(layers, {...wipe, stageMessage: 'Unrelated'}, before);
  expect(draw).toHaveBeenLastCalledWith(
    layers,
    expect.objectContaining({slideTransition: wipe.slideTransition}),
  );
  preview.render(
    layers,
    {...wipe, slideTransition: {kind: 'push', sec: 0.5}},
    before,
  );
  preview.render(layers, initial, before);
  const calls = draw.mock.calls.length;
  vi.advanceTimersByTime(32);
  expect(draw).toHaveBeenCalledTimes(calls);
  expect(draw).toHaveBeenLastCalledWith(layers, {
    ...initial,
    transitions: false,
  });
  preview.render(layers, wipe, before);
  preview.dispose();
  vi.advanceTimersByTime(32);
  expect(vi.getTimerCount()).toBe(0);
  expect(draw).toHaveBeenLastCalledWith(
    before,
    expect.objectContaining({transitions: false}),
  );
});
