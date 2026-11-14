import {afterEach, describe, expect, it, vi} from 'vitest';
import {SlideAnimation} from '@renderer/rendering/slideAnimation';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const old = document.createElement('div');
  const next = document.createElement('div');
  const cancel = vi.fn();
  const animate = vi.fn((...args: Parameters<HTMLElement['animate']>) => {
    return {cancel, count: args.length};
  });
  Object.defineProperty(old, 'animate', {value: animate});
  Object.defineProperty(next, 'animate', {value: animate});
  return {old, next, cancel, animate, view: new SlideAnimation()};
}

describe('SlideAnimation', () => {
  it('keeps the old page still while revealing the new page with a feathered mask', () => {
    const {view, old, next, animate} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 1});
    expect(animate).toHaveBeenNthCalledWith(1, [{opacity: 1}, {opacity: 1}], {
      duration: 1000,
      easing: 'linear',
    });
    expect(animate).toHaveBeenNthCalledWith(
      2,
      [
        {
          maskImage:
            'linear-gradient(to left, black 0%, black 35.087719%, transparent 64.912281%, transparent 100%)',
          maskSize: '285% 100%',
          maskPosition: '0% 0%',
          maskRepeat: 'no-repeat',
        },
        {
          maskImage:
            'linear-gradient(to left, black 0%, black 35.087719%, transparent 64.912281%, transparent 100%)',
          maskSize: '285% 100%',
          maskPosition: '100% 0%',
          maskRepeat: 'no-repeat',
        },
      ],
      {duration: 1000, easing: 'linear'},
    );
  });
  it('moves the feather across the whole screen over the whole duration', () => {
    const {view, old, next, animate} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 1});
    const frames = animate.mock.calls[1]?.[0];
    if (!Array.isArray(frames)) throw new Error('Missing wipe keyframes');
    const first = frames[0];
    if (
      first === undefined ||
      typeof first.maskImage !== 'string' ||
      typeof first.maskSize !== 'string'
    ) {
      throw new Error('Missing mask');
    }
    const stops = /black ([\d.]+)%, transparent ([\d.]+)%/.exec(
      first.maskImage,
    );
    if (!stops) throw new Error('Missing feather stops');
    const size = Number.parseFloat(first.maskSize) / 100;
    const transparentStop = Number(stops[2]) / 100;
    const edgeAt = (progress: number) =>
      Math.max(
        0,
        Math.min(1, size * (1 - transparentStop) + (1 - size) * progress),
      );
    expect(edgeAt(0)).toBeCloseTo(1, 5);
    expect(edgeAt(0.5)).toBeCloseTo(0.075, 5);
    expect((size * (Number(stops[2]) - Number(stops[1]))) / 100).toBeCloseTo(
      0.85,
      5,
    );
    expect(edgeAt(1)).toBeCloseTo(0, 5);
  });
  it.each([
    ['left', 'translateX(100%)', 'translateX(-100%)'],
    ['right', 'translateX(-100%)', 'translateX(100%)'],
    ['up', 'translateY(100%)', 'translateY(-100%)'],
    ['down', 'translateY(-100%)', 'translateY(100%)'],
  ] as const)(
    'pushes both pages %s with the same timing',
    (dir, incoming, outgoing) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'push', dir, sec: 4});
      expect(animate.mock.calls).toEqual([
        [
          [
            {transform: 'translate(0)', opacity: 1},
            {transform: outgoing, opacity: 1},
          ],
          {duration: 4000, easing: 'linear'},
        ],
        [
          [{transform: incoming}, {transform: 'translate(0)'}],
          {duration: 4000, easing: 'linear'},
        ],
      ]);
    },
  );
  it.each([
    [
      'left',
      {direction: 'left', size: '285% 100%', from: '0% 0%', to: '100% 0%'},
    ],
    [
      'right',
      {direction: 'right', size: '285% 100%', from: '100% 0%', to: '0% 0%'},
    ],
    ['up', {direction: 'top', size: '100% 285%', from: '0% 0%', to: '0% 100%'}],
    [
      'down',
      {direction: 'bottom', size: '100% 285%', from: '0% 100%', to: '0% 0%'},
    ],
  ] as const)(
    'reveals the incoming page in direction %s',
    (dir, {direction, size, from, to}) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'wipe', dir, sec: 0.5});
      const maskImage = `linear-gradient(to ${direction}, black 0%, black 35.087719%, transparent 64.912281%, transparent 100%)`;
      expect(animate).toHaveBeenNthCalledWith(
        2,
        [
          {
            maskImage,
            maskSize: size,
            maskPosition: from,
            maskRepeat: 'no-repeat',
          },
          {
            maskImage,
            maskSize: size,
            maskPosition: to,
            maskRepeat: 'no-repeat',
          },
        ],
        {duration: 500, easing: 'linear'},
      );
    },
  );
  it('cancels both pages on interruption, cuts, and disposal', () => {
    const {view, old, next, animate, cancel} = setup();
    view.play(old, next, {kind: 'dissolve', sec: 0.5});
    view.play(next, old, {kind: 'push', sec: 1});
    expect(cancel).toHaveBeenCalledTimes(2);
    view.play(old, next, {kind: 'none', sec: 1});
    expect(cancel).toHaveBeenCalledTimes(4);
    expect(animate).toHaveBeenCalledTimes(4);
    expect(next.style.opacity).toBe('1');
    expect(old.style.opacity).toBe('0');
    view.cancel();
    expect(cancel).toHaveBeenCalledTimes(4);
  });
});
