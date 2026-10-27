import {expect, it} from 'vitest';
import {resizeHandles} from './frameEdit';
import {guideFrame} from './smartGuides';

const start = {x: 100, y: 100, w: 100, h: 80, future: 7};
const target = {x: 300, y: 400, w: 200, h: 100};
function move(overrides: Partial<Parameters<typeof guideFrame>[0]> = {}) {
  return guideFrame({
    start,
    delta: {x: 249, y: 309},
    handle: 'move',
    keepRatio: false,
    snapGrid: false,
    bypass: false,
    scale: 1,
    distance: 6,
    targets: [target],
    ...overrides,
  });
}

it('aligns centers independently and preserves unknown geometry fields', () => {
  expect(move()).toEqual({
    frame: {...start, x: 350, y: 410},
    guides: {x: 400, y: 450},
  });
});
it.each([0.5, 1, 2])(
  'acquires inclusively at six viewport pixels with zoom %s',
  scale => {
    const distance = 6 / scale;
    expect(move({scale, delta: {x: 100 - distance, y: 0}})).toMatchObject({
      frame: {x: 200},
      guides: {x: 300},
    });
    expect(
      move({scale, delta: {x: 100 - distance - 0.01, y: 0}}).guides,
    ).toEqual({});
  },
);
it('uses a guide before the grid only on its matched axis', () => {
  expect(move({snapGrid: true, delta: {x: 249, y: 13}})).toEqual({
    frame: {...start, x: 350, y: 120},
    guides: {x: 400},
  });
});
it('bypasses snapping without changing the saved gesture origin', () => {
  expect(move({bypass: true, snapGrid: true})).toEqual({
    frame: {...start, x: 349, y: 409},
    guides: {},
  });
  expect(move().frame.x).toBe(350);
});
it('retains target order for equally near matches', () => {
  const options = {
    delta: {x: 44, y: 0},
    targets: [
      {x: 0, y: 800, w: 200, h: 100},
      {x: 188, y: 900, w: 200, h: 100},
    ],
  };
  expect(move(options).guides).toEqual({x: 200});
  expect(move(options).guides).toEqual({x: 200});
});
it('keeps exact fractional center alignment', () => {
  expect(move({targets: [{...target, w: 201}], delta: {x: 250, y: 0}})).toEqual(
    {
      frame: {...start, x: 350.5},
      guides: {x: 400.5},
    },
  );
});
it.each(resizeHandles)(
  'snaps only the moving edges of %s without moving their opposites',
  handle => {
    const frame = {x: 100, y: 100, w: 400, h: 200};
    const {frame: next, guides} = move({
      start: frame,
      handle,
      delta: {
        x: handle.includes('w') ? -94 : 94,
        y: handle.includes('n') ? -94 : 94,
      },
      targets: [{x: 0, y: 0, w: 600, h: 400}],
    });
    if (handle.includes('w')) {
      expect(next.x).toBe(0);
      expect(next.x + next.w).toBe(500);
      expect(guides.x).toBe(0);
    } else if (handle.includes('e')) {
      expect(next.x).toBe(100);
      expect(next.x + next.w).toBe(600);
      expect(guides.x).toBe(600);
    } else {
      expect(next.x).toBe(frame.x);
      expect(next.w).toBe(frame.w);
      expect(guides.x).toBeUndefined();
    }
    if (handle.includes('n')) {
      expect(next.y).toBe(0);
      expect(next.y + next.h).toBe(300);
      expect(guides.y).toBe(0);
    } else if (handle.includes('s')) {
      expect(next.y).toBe(100);
      expect(next.y + next.h).toBe(400);
      expect(guides.y).toBe(400);
    } else {
      expect(next.y).toBe(frame.y);
      expect(next.h).toBe(frame.h);
      expect(guides.y).toBeUndefined();
    }
  },
);
it('keeps ratio and opposite anchors, showing only actual alignments', () => {
  expect(
    move({
      start: {...start, w: 200, h: 100},
      handle: 'se',
      keepRatio: true,
      delta: {x: 194, y: 94},
      targets: [{x: 0, y: 0, w: 1000, h: 700}],
    }),
  ).toEqual({
    frame: {...start, w: 400, h: 200},
    guides: {x: 500},
  });
  expect(
    move({
      start: {...start, w: 200, h: 100},
      handle: 'nw',
      keepRatio: true,
      delta: {x: -94, y: -47},
      targets: [{x: 0, y: 0, w: 1000, h: 700}],
    }),
  ).toMatchObject({frame: {x: 0, y: 50, w: 300, h: 150}, guides: {x: 0}});
});
it('does not acquire an illegal resize or jump on a zero-distance click', () => {
  expect(move({delta: {x: 0, y: 0}, snapGrid: true})).toEqual({
    frame: start,
    guides: {},
  });
  expect(
    move({
      handle: 'w',
      delta: {x: 99, y: 0},
      targets: [{x: 200, y: 500, w: 100, h: 100}],
    }),
  ).toEqual({frame: {...start, x: 199, w: 1}, guides: {}});
});
it.each([0, NaN, Infinity])(
  'disables guides for an unusable scale %s',
  scale => {
    expect(move({scale}).guides).toEqual({});
  },
);
