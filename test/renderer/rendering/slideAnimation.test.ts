import {afterEach, describe, expect, it, vi} from 'vitest';
import {SlideAnimation} from '@renderer/rendering/slideAnimation';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const old = document.createElement('div');
  const next = document.createElement('div');
  const cancel = vi.fn();
  const animate = vi.fn(() => ({cancel}));
  Object.defineProperty(old, 'animate', {value: animate});
  Object.defineProperty(next, 'animate', {value: animate});
  return {old, next, cancel, animate, view: new SlideAnimation()};
}

describe('SlideAnimation', () => {
  it('aligns separated theme boxes to one screen-wide wipe and push', () => {
    const {view, old, next, animate} = setup();
    view.setFrame({x: 100, y: 200, w: 800, h: 400});
    view.play(old, next, {kind: 'wipe', dir: 'left', sec: 1});
    expect(animate).toHaveBeenNthCalledWith(
      2,
      [
        {clipPath: 'inset(-200px -1020px -480px 1820px)'},
        {clipPath: 'inset(-200px -1020px -480px -100px)'},
      ],
      {duration: 1000, easing: 'linear'},
    );
    view.play(old, next, {kind: 'push', dir: 'up', sec: 1});
    expect(animate).toHaveBeenNthCalledWith(
      4,
      [{transform: 'translateY(1080px)'}, {transform: 'translate(0)'}],
      {duration: 1000, easing: 'linear'},
    );
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
    ['left', 'inset(0 0 0 100%)', 'inset(0 100% 0 0)'],
    ['right', 'inset(0 100% 0 0)', 'inset(0 0 0 100%)'],
    ['up', 'inset(100% 0 0 0)', 'inset(0 0 100% 0)'],
    ['down', 'inset(0 0 100% 0)', 'inset(100% 0 0 0)'],
  ] as const)(
    'wipes a complementary hard edge %s without moving either page',
    (dir, incoming, outgoing) => {
      const {view, old, next, animate} = setup();
      view.play(old, next, {kind: 'wipe', dir, sec: 0.5});
      expect(animate.mock.calls).toEqual([
        [
          [
            {clipPath: 'inset(0)', opacity: 1},
            {clipPath: outgoing, opacity: 1},
          ],
          {duration: 500, easing: 'linear'},
        ],
        [
          [{clipPath: incoming}, {clipPath: 'inset(0)'}],
          {duration: 500, easing: 'linear'},
        ],
      ]);
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
