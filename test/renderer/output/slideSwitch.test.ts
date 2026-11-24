import {afterEach, beforeEach, expect, it, vi, type MockInstance} from 'vitest';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import type {SlideTransition} from '@core/schema/slides/slideTransition';
import {CUT, SlideSwitch} from '@renderer/output/slideSwitch';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';

const DISSOLVE: SlideTransition = {kind: 'dissolve', sec: 1};
const cancels: Array<() => void> = [];
let finish: Array<() => void> = [];

// NOTE(0913vision): jsdom has no animations.
Object.defineProperty(HTMLElement.prototype, 'animate', {
  configurable: true,
  value: () => {
    const cancel = vi.fn();
    cancels.push(cancel);
    return {
      cancel,
      finished: new Promise<void>(resolve => finish.push(resolve)),
    };
  },
});

beforeEach(() => {
  vi.useFakeTimers();
  cancels.length = 0;
  finish = [];
});
afterEach(() => vi.useRealTimers());

function setup(present?: (effect: SlideTransition) => void) {
  const parent = document.createElement('div');
  const pages: Array<{
    readonly renderer: OutputRenderer;
    readonly surface: HTMLElement;
    readonly freeze: MockInstance;
    readonly dispose: MockInstance;
  }> = [];
  const onLate = vi.fn();
  const onError = vi.fn();
  const slides = new SlideSwitch({
    create: () => {
      const renderer = new OutputRenderer(parent, {
        mediaUrl: String,
        onError: vi.fn(),
      });
      pages.push({
        renderer,
        surface: renderer.transitionSurface(),
        freeze: vi.spyOn(renderer, 'freeze'),
        dispose: vi.spyOn(renderer, 'dispose'),
      });
      return renderer;
    },
    present,
    onLate,
    onError,
  });
  const change = (
    effect: SlideTransition,
    complete = true,
  ): {ready: boolean} => {
    const state = {ready: complete};
    slides.change(effect, {draw: () => undefined, complete: () => state.ready});
    return state;
  };
  return {slides, pages, change, onLate, onError};
}

it('shows the next slide with its transition over the one that shows', async () => {
  const {slides, pages, change} = setup();
  slides.renderer();
  change(DISSOLVE);
  const [old, next] = pages;
  expect(old?.freeze).toHaveBeenCalledOnce();
  expect(next?.surface.style.visibility).toBe('');
  expect(next?.surface.style.zIndex).toBe('1');
  expect(slides.changing).toBe(true);
  expect(old?.dispose).not.toHaveBeenCalled();
  finish.forEach(done => done());
  await vi.advanceTimersByTimeAsync(0);
  expect(slides.changing).toBe(false);
  expect(old?.dispose).toHaveBeenCalledOnce();
  expect(slides.renderer()).toBe(next?.renderer);
  expect(next?.surface.style.zIndex).toBe('');
});

it('keeps the next slide out of sight until it is drawn completely', async () => {
  const {slides, pages, change} = setup();
  slides.renderer();
  const state = change(DISSOLVE, false);
  await vi.advanceTimersByTimeAsync(40);
  expect(pages[1]?.surface.style.visibility).toBe('hidden');
  state.ready = true;
  await vi.advanceTimersByTimeAsync(40);
  expect(pages[1]?.surface.style.visibility).toBe('');
});

it('shows a slide that does not get ready after its deadline, and says so', async () => {
  const {slides, pages, change, onLate} = setup();
  slides.renderer();
  change(DISSOLVE, false);
  await vi.advanceTimersByTimeAsync(OUTPUT_REVEAL_DEADLINE_MS + 20);
  expect(onLate).toHaveBeenCalledWith(pages[1]?.renderer);
  expect(pages[1]?.surface.style.visibility).toBe('');
});

it('ends a running transition when the next slide comes', () => {
  const {slides, pages, change} = setup();
  slides.renderer();
  change(DISSOLVE);
  change(DISSOLVE);
  expect(cancels[0]).toHaveBeenCalledOnce();
  expect(pages[0]?.dispose).toHaveBeenCalledOnce();
  expect(pages[1]?.freeze).toHaveBeenCalledOnce();
  expect(pages[1]?.dispose).not.toHaveBeenCalled();
  expect(slides.renderer()).toBe(pages[2]?.renderer);
});

it('keeps the picture on screen when a slide was never shown', () => {
  const {slides, pages, change} = setup();
  slides.renderer();
  change(DISSOLVE, false);
  change(DISSOLVE);
  expect(pages[1]?.dispose).toHaveBeenCalledOnce();
  expect(pages[0]?.dispose).not.toHaveBeenCalled();
  expect(slides.changing).toBe(true);
});

it('shows the slide whole when its transition is ended', () => {
  const {slides, pages, change} = setup();
  slides.renderer();
  change(DISSOLVE);
  slides.end();
  expect(cancels[0]).toHaveBeenCalledOnce();
  expect(slides.changing).toBe(false);
  expect(slides.renderer()).toBe(pages[1]?.renderer);
  expect(pages[1]?.surface.style.visibility).toBe('');
});

it('leaves the transition to the presenter when there is one', () => {
  const present = vi.fn<(effect: SlideTransition) => void>();
  const {slides, pages, change} = setup(present);
  slides.renderer();
  change(DISSOLVE);
  expect(present.mock.calls.map(([effect]) => effect)).toEqual([CUT, DISSOLVE]);
  expect(cancels).toEqual([]);
  expect(pages[0]?.dispose).toHaveBeenCalledOnce();
  expect(slides.changing).toBe(false);
});

it('shows the slide when its transition fails', () => {
  const present = vi.fn((effect: SlideTransition) => {
    if (effect !== CUT) throw new Error('no presenter');
  });
  const {slides, pages, change, onError} = setup(present);
  slides.renderer();
  change(DISSOLVE);
  expect(onError).toHaveBeenCalledOnce();
  expect(pages[1]?.surface.style.visibility).toBe('');
  expect(slides.changing).toBe(false);
});

it('frees both slides', () => {
  const {slides, pages, change} = setup();
  slides.renderer();
  change(DISSOLVE);
  slides.dispose();
  for (const page of pages) expect(page.dispose).toHaveBeenCalledOnce();
});
