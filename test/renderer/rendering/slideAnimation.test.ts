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
  it('keeps the outgoing push still until the incoming picture is ready', () => {
    const old = document.createElement('div');
    const next = document.createElement('div');
    const outgoing = {pause: vi.fn(), play: vi.fn(), currentTime: 0};
    const incoming = {currentTime: 700, playState: 'running'};
    Object.defineProperty(old, 'animate', {value: () => outgoing});
    Object.defineProperty(next, 'animate', {value: () => incoming});
    const view = new SlideAnimation(true);
    view.play(old, next, {kind: 'push', dir: 'left', sec: 4});
    view.holdOutgoing();
    expect(outgoing.pause).toHaveBeenCalledOnce();
    expect(old.style.opacity).toBe('1');
    view.resumeOutgoing();
    expect(outgoing.currentTime).toBe(700);
    expect(outgoing.play).toHaveBeenCalledOnce();
  });
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
            'linear-gradient(to left, black 0%, black 36.666667%, transparent 63.333333%, transparent 100%)',
          maskSize: '300% 100%',
          maskPosition: '-8% 0%',
          maskRepeat: 'no-repeat',
        },
        {
          maskImage:
            'linear-gradient(to left, black 0%, black 36.666667%, transparent 63.333333%, transparent 100%)',
          maskSize: '300% 100%',
          maskPosition: '95% 0%',
          maskRepeat: 'no-repeat',
        },
      ],
      {duration: 954, easing: 'linear'},
    );
  });
  it('sweeps a 0.8-screen feather 2.06 screen widths in 95.4% of the set time', () => {
    const {view, old, next, animate} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 0.7});
    const frames = animate.mock.calls[0]?.[0];
    if (!Array.isArray(frames)) throw new Error('Missing wipe keyframes');
    expect(animate.mock.calls[0]?.[1]).toEqual({
      duration: 667.8,
      easing: 'linear',
    });
    const size = Number.parseFloat(String(frames[0]?.maskSize)) / 100;
    const from = Number.parseFloat(String(frames[0]?.maskPosition)) / 100;
    const to = Number.parseFloat(String(frames[1]?.maskPosition)) / 100;
    const center = (p: number) =>
      size / 2 + (1 - size) * (from + (to - from) * p);
    expect(center(0)).toBeCloseTo(1.66, 5);
    expect(center(0.5)).toBeCloseTo(0.63, 5);
    expect(center(1)).toBeCloseTo(-0.4, 5);
    expect(0.954 / Math.abs(center(1) - center(0))).toBeCloseTo(0.463, 2);
    expect((size * (63.333333 - 36.666667)) / 100).toBeCloseTo(0.8, 5);
  });
  it.each([
    [1, 10, 0.0871],
    [1, 15, 0.4137],
    [1, 19, 0.6762],
    [1, 20, 0.8074],
    [1, 22, 0.9387],
    [0.7, 8, 0.148],
    [0.7, 12, 0.5309],
    [0.7, 16, 0.9059],
  ])(
    'keeps the %ss wipe at frame %i within one frame of the PowerPoint crossing',
    (seconds, frame, powerpoint) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'wipe', dir: 'right', sec: seconds});
      const keyframes = animate.mock.calls[0]?.[0];
      if (!Array.isArray(keyframes)) throw Error('Missing wipe keyframes');
      const from = Number.parseFloat(String(keyframes[0]?.maskPosition)) / 100;
      const to = Number.parseFloat(String(keyframes[1]?.maskPosition)) / 100;
      const duration = seconds * 954;
      const progress = Math.min(1, (frame * 1000) / 30 / duration);
      const crossing = 1.5 - 2 * (from + (to - from) * progress);
      expect(Math.abs(crossing - powerpoint)).toBeLessThan(
        2.16 / (30 * seconds),
      );
    },
  );
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
        from: '-8% 0%',
        to: '95% 0%',
      },
    ],
    [
      'right',
      {
        direction: 'right',
        size: '300% 100%',
        from: '108% 0%',
        to: '5% 0%',
      },
    ],
    [
      'up',
      {
        direction: 'top',
        size: '100% 300%',
        from: '0% -8%',
        to: '0% 95%',
      },
    ],
    [
      'down',
      {
        direction: 'bottom',
        size: '100% 300%',
        from: '0% 108%',
        to: '0% 5%',
      },
    ],
  ] as const)(
    'reveals the incoming page in direction %s',
    (dir, {direction, size, from, to}) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'wipe', dir, sec: 0.5});
      const maskImage = `linear-gradient(to ${direction}, black 0%, black 36.666667%, transparent 63.333333%, transparent 100%)`;
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
        {duration: 477, easing: 'linear'},
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
