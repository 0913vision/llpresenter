import {afterEach, describe, expect, it, vi} from 'vitest';
import {SlideAnimation, wipeMask} from '@renderer/rendering/slideAnimation';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const old = document.createElement('div');
  const next = document.createElement('div');
  const parent = document.createElement('div');
  parent.append(old, next);
  const cancel = vi.fn();
  const animate = vi.fn((...args: Parameters<HTMLElement['animate']>) => {
    return {cancel, count: args.length};
  });
  Object.defineProperty(old, 'animate', {value: animate});
  Object.defineProperty(next, 'animate', {value: animate});
  return {old, next, parent, cancel, animate, view: new SlideAnimation()};
}

describe('SlideAnimation', () => {
  it('restores the incoming surface when a wipe is interrupted', () => {
    const {view, old, next, parent, cancel} = setup();
    next.style.width = '80%';
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 4});
    expect(next.parentElement).not.toBe(parent);
    view.cancel();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(next.parentElement).toBe(parent);
    expect(next.style.width).toBe('80%');
    expect(next.style.willChange).toBe('');
  });
  it('keeps the old page still while revealing the new page with a feathered mask', () => {
    const {view, old, next, animate} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 1});
    expect(old.style.opacity).toBe('1');
    expect(animate).toHaveBeenCalledTimes(2);
    const wrapper = next.parentElement;
    if (wrapper === null) throw new Error('Missing wipe wrapper');
    const frames = animate.mock.calls[0]?.[0];
    if (!Array.isArray(frames)) throw new Error('Missing wipe keyframes');
    expect(wrapper.style.maskImage).toMatch(/^linear-gradient\(to left,/);
    expect(wrapper.style.width).toBe('400%');
    expect(
      frames.every(frame =>
        Object.keys(frame).every(key => key === 'transform'),
      ),
    ).toBe(true);
    const inner = animate.mock.calls[1]?.[0];
    if (!Array.isArray(inner)) throw new Error('Missing counter-motion');
    expect(
      Number.parseFloat(String(inner[0]?.transform).replace('translateX(', '')),
    ).toBeCloseTo(58);
    expect(
      Number.parseFloat(String(inner[1]?.transform).replace('translateX(', '')),
    ).toBeCloseTo(300);
    expect(animate.mock.calls[0]?.[1]).toEqual({
      duration: 922,
      easing: 'linear',
    });
  });
  it('sweeps a 0.96-screen feather with the PowerPoint midpoint timing', () => {
    const {view, old, next, animate} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 0.7});
    const frames = animate.mock.calls[0]?.[0];
    if (!Array.isArray(frames)) throw new Error('Missing wipe keyframes');
    expect(animate.mock.calls[0]?.[1]).toEqual({
      duration: 645.4,
      easing: 'linear',
    });
    const offset = (frame: Keyframe | undefined) =>
      (Number.parseFloat(String(frame?.transform).replace('translateX(', '')) *
        4) /
      100;
    const from = offset(frames[0]);
    const to = offset(frames[1]);
    const center = (p: number) => 2 + from + (to - from) * p;
    expect(center(0)).toBeCloseTo(1.42, 5);
    expect(center(0.5)).toBeCloseTo(0.21, 5);
    expect(center(1)).toBeCloseTo(-1, 5);
    expect(
      (4 * 0.922 * (center(0) - 0.5)) / (center(0) - center(1)),
    ).toBeCloseTo(1.4, 1);
    expect((4 * (62 - 38)) / 100).toBeCloseTo(0.96, 5);
  });
  it('uses a monotone smooth edge fitted to the PowerPoint four-second capture', () => {
    const {view, old, next} = setup();
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 4});
    const mask = wipeMask('left');
    const stops = [
      ...mask.matchAll(/rgba\(0, 0, 0, ([\d.]+)\) ([\d.]+)%/g),
    ].map(match => ({alpha: Number(match[1]), position: Number(match[2])}));
    expect(stops).toHaveLength(33);
    expect(stops[0]).toEqual({alpha: 1, position: 38});
    expect(stops.at(-1)).toEqual({alpha: 0, position: 62});
    const slopes = stops
      .slice(1)
      .map((stop, index) => stop.alpha - (stops[index]?.alpha ?? 0));
    expect(slopes.every(slope => slope <= 0)).toBe(true);
    expect(Math.abs(slopes[0] ?? 1)).toBeLessThan(0.004);
    expect(Math.abs(slopes.at(-1) ?? 1)).toBeLessThan(0.004);
    expect(
      slopes
        .slice(1)
        .every(
          (slope, index) => Math.abs(slope - (slopes[index] ?? 0)) < 0.006,
        ),
    ).toBe(true);
    const measured = [
      0, 0, 0.02, 0.04, 0.09, 0.15, 0.23, 0.31, 0.4, 0.51, 0.61, 0.71, 0.79,
      0.85,
    ];
    const error = measured.reduce((sum, value, index) => {
      const t = Math.max(0, Math.min(1, (index * 120 - 146) / (1920 * 0.96)));
      const position = t * (stops.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(stops.length - 1, lower + 1);
      const alpha =
        (stops[lower]?.alpha ?? 0) * (1 - (position - lower)) +
        (stops[upper]?.alpha ?? 0) * (position - lower);
      return sum + (1 - alpha - value) ** 2;
    }, 0);
    expect(Math.sqrt(error / measured.length)).toBeLessThan(0.01);
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
    (dir, {direction}) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'wipe', dir, sec: 0.5});
      const frames = animate.mock.calls[0]?.[0];
      if (!Array.isArray(frames)) throw new Error('Missing wipe keyframes');
      const maskImage = next.parentElement?.style.maskImage;
      expect(maskImage).toMatch(
        new RegExp(`^linear-gradient\\(to ${direction},`),
      );
      expect(old.style.opacity).toBe('1');
      expect(animate).toHaveBeenCalledTimes(2);
      expect(
        frames.every(frame =>
          Object.keys(frame).every(key => key === 'transform'),
        ),
      ).toBe(true);
      expect(animate.mock.calls[0]?.[1]).toEqual({
        duration: 461,
        easing: 'linear',
      });
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
