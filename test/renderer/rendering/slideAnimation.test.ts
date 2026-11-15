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
    expect(old.style.opacity).toBe('1');
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenNthCalledWith(
      1,
      [
        {
          maskImage:
            'linear-gradient(to left, black 0%, black 38.333333%, transparent 61.666667%, transparent 100%)',
          maskSize: '300% 100%',
          maskPosition: '1.5% 0%',
          maskRepeat: 'no-repeat',
        },
        {
          maskImage:
            'linear-gradient(to left, black 0%, black 38.333333%, transparent 61.666667%, transparent 100%)',
          maskSize: '300% 100%',
          maskPosition: '98% 0%',
          maskRepeat: 'no-repeat',
        },
      ],
      {duration: 830, easing: 'linear'},
    );
  });
  it('sweeps a 0.7-screen feather 1.93 screen widths in 83% of the set time', () => {
    const {view, old, next, animate} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 0.7});
    const frames = animate.mock.calls[0]?.[0];
    if (!Array.isArray(frames)) throw new Error('Missing wipe keyframes');
    expect(animate.mock.calls[0]?.[1]).toEqual({
      duration: 581,
      easing: 'linear',
    });
    const size = Number.parseFloat(String(frames[0]?.maskSize)) / 100;
    const from = Number.parseFloat(String(frames[0]?.maskPosition)) / 100;
    const to = Number.parseFloat(String(frames[1]?.maskPosition)) / 100;
    const center = (p: number) =>
      size / 2 + (1 - size) * (from + (to - from) * p);
    expect(center(0)).toBeCloseTo(1.47, 5);
    expect(center(0.5)).toBeCloseTo(0.505, 5);
    expect(center(1)).toBeCloseTo(-0.46, 5);
    expect((size * (61.666667 - 38.333333)) / 100).toBeCloseTo(0.7, 5);
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
      {
        direction: 'left',
        size: '300% 100%',
        from: '1.5% 0%',
        to: '98% 0%',
      },
    ],
    [
      'right',
      {
        direction: 'right',
        size: '300% 100%',
        from: '98.5% 0%',
        to: '2% 0%',
      },
    ],
    [
      'up',
      {
        direction: 'top',
        size: '100% 300%',
        from: '0% 1.5%',
        to: '0% 98%',
      },
    ],
    [
      'down',
      {
        direction: 'bottom',
        size: '100% 300%',
        from: '0% 98.5%',
        to: '0% 2%',
      },
    ],
  ] as const)(
    'reveals the incoming page in direction %s',
    (dir, {direction, size, from, to}) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'wipe', dir, sec: 0.5});
      const maskImage = `linear-gradient(to ${direction}, black 0%, black 38.333333%, transparent 61.666667%, transparent 100%)`;
      expect(old.style.opacity).toBe('1');
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenNthCalledWith(
        1,
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
        {duration: 415, easing: 'linear'},
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
