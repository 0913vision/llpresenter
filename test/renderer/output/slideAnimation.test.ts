import {afterEach, expect, it, vi} from 'vitest';
import {SlideAnimation} from '@renderer/output/slideAnimation';

interface Played {
  readonly frames: readonly Keyframe[];
  readonly timing: KeyframeAnimationOptions;
  readonly on: HTMLElement;
}

const played: Played[] = [];
const cancel = vi.fn();

function animate(
  this: HTMLElement,
  frames: Keyframe[],
  timing: KeyframeAnimationOptions,
) {
  played.push({frames, timing, on: this});
  return {cancel, finished: Promise.resolve()};
}

// NOTE(0913vision): jsdom has no animations.
Object.defineProperty(HTMLElement.prototype, 'animate', {
  configurable: true,
  value: animate,
});

afterEach(() => {
  played.length = 0;
  cancel.mockClear();
});

function setup() {
  const parent = document.createElement('div');
  const old = document.createElement('div');
  const next = document.createElement('div');
  parent.append(old, next);
  return {parent, old, next, view: new SlideAnimation()};
}

function shiftOf(frame: Keyframe | undefined): number {
  return Number.parseFloat(
    String(frame?.['transform']).replace(/^translate[XY]\(/u, ''),
  );
}

it('shows a slide without a transition at once', () => {
  const {view, old, next} = setup();
  view.play(old, next, {kind: 'none', sec: 0.5});
  expect(played).toEqual([]);
  expect(next.style.zIndex).toBe('1');
});

it('fades the next slide in over the whole old one', () => {
  const {view, old, next} = setup();
  view.play(old, next, {kind: 'dissolve', sec: 1.5});
  expect(played).toEqual([
    {
      frames: [{opacity: 0}, {opacity: 1}],
      timing: {duration: 1500, easing: 'linear', fill: 'both'},
      on: next,
    },
  ]);
});

it.each([
  ['left', 'translateX(100%)', 'translateX(-100%)'],
  ['right', 'translateX(-100%)', 'translateX(100%)'],
  ['up', 'translateY(100%)', 'translateY(-100%)'],
  ['down', 'translateY(-100%)', 'translateY(100%)'],
] as const)('pushes both slides %s', (dir, from, to) => {
  const {view, old, next} = setup();
  view.play(old, next, {kind: 'push', dir, sec: 1});
  expect(played.map(({frames, on}) => ({frames, on}))).toEqual([
    {frames: [{transform: 'none'}, {transform: to}], on: old},
    {frames: [{transform: from}, {transform: 'none'}], on: next},
  ]);
});

it.each(['left', 'right', 'up', 'down'] as const)(
  'keeps the slide in its place while a wipe moves %s over it',
  dir => {
    const {view, old, next} = setup();
    view.play(old, next, {kind: 'wipe', dir, sec: 4});
    const [mask, slide] = played;
    expect(mask?.on).toBe(next.parentElement);
    expect(slide?.on).toBe(next);
    expect(mask?.timing).toEqual({
      duration: 4000,
      easing: 'linear',
      fill: 'both',
    });
    for (const index of [0, 1]) {
      expect(
        shiftOf(mask?.frames[index]) * 4 + shiftOf(slide?.frames[index]),
      ).toBeCloseTo(0, 6);
    }
  },
);

it.each(['left', 'right', 'up', 'down'] as const)(
  'wipes %s from nothing shown to everything shown in its whole time',
  dir => {
    const {view, old, next} = setup();
    view.play(old, next, {kind: 'wipe', dir, sec: 4});
    const image = next.parentElement?.style.maskImage ?? '';
    const stops = [
      ...image.matchAll(/rgba?\(0,\s*0,\s*0(?:,\s*([\d.]+))?\) ([\d.]+)%/gu),
    ].map(match => ({alpha: Number(match[1] ?? 1), at: Number(match[2]) / 25}));
    const [first, last] = [stops[0], stops.at(-1)];
    if (first === undefined || last === undefined) {
      throw new Error('Missing wipe mask');
    }
    expect([first.alpha, last.alpha]).toEqual([0, 1]);
    expect(last.at - first.at).toBeCloseTo(0.97, 2);
    const forward = dir === 'right' || dir === 'down';
    const begin = forward ? first.at : 4 - last.at;
    const places = [0, 1].map(
      index => begin + (shiftOf(played[0]?.frames[index]) * 4) / 100,
    );
    expect(Math.min(...places)).toBeCloseTo(-0.97, 2);
    expect(Math.max(...places)).toBeCloseTo(1, 2);
  },
);

it('puts the slide back in its place when a wipe ends', () => {
  const {view, old, next, parent} = setup();
  next.style.width = '80%';
  view.play(old, next, {kind: 'wipe', dir: 'left', sec: 4});
  expect(next.parentElement).not.toBe(parent);
  view.cancel();
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(next.parentElement).toBe(parent);
  expect(next.style.width).toBe('80%');
  expect(next.style.willChange).toBe('');
});
