import {expect, it} from 'vitest';
import {slideTransitionFor} from '@core/output/transitions';
import {serviceItemIdSchema} from '@core/schema/common/ids';
import * as v from 'valibot';

const itemId = v.parse(
  serviceItemIdSchema,
  '00000000-0000-4000-8000-000000000009',
);

it('cuts to a slide without a transition', () => {
  expect(slideTransitionFor({itemId}).kind).toBe('none');
  expect(slideTransitionFor(null).kind).toBe('none');
});

it.each(['none', 'dissolve', 'push', 'wipe'] as const)(
  'brings a slide in with its own %s',
  kind => {
    const transition = {kind, sec: 1.5};
    expect(slideTransitionFor({itemId, transition})).toEqual(transition);
  },
);

it.each([
  ['left', 'right'],
  ['right', 'left'],
  ['up', 'down'],
  ['down', 'up'],
] as const)('plays a wipe %s backward on the way back', (dir, opposite) => {
  expect(
    slideTransitionFor({
      itemId,
      transition: {kind: 'dissolve', sec: 1},
      reverseTransition: {kind: 'wipe', dir, sec: 2},
    }),
  ).toEqual({kind: 'wipe', dir: opposite, sec: 2});
});

it('cuts on the way back from a slide without a transition', () => {
  expect(
    slideTransitionFor({
      itemId,
      transition: {kind: 'wipe', sec: 1},
      reverseTransition: null,
    }).kind,
  ).toBe('none');
});
