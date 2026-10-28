import {expect, it} from 'vitest';
import * as v from 'valibot';
import {jsonObject, listWithUniqueIds} from './primitives';

const schema = listWithUniqueIds(jsonObject({id: v.string()}));

it('validates a full media-sized list and identifies duplicate positions', () => {
  const items = Array.from({length: 10_000}, (_, index) => ({
    id: `item-${index}`,
  }));
  expect(v.safeParse(schema, items).success).toBe(true);
  const result = v.safeParse(schema, [
    ...items,
    {id: 'item-0'},
    {id: 'item-9999'},
  ]);
  expect(result.success).toBe(false);
  expect(
    result.issues?.map(issue => ({
      message: issue.message,
      index: issue.path?.[0]?.key,
    })),
  ).toEqual([
    {message: 'Another item already has this id', index: 10_000},
    {message: 'Another item already has this id', index: 10_001},
  ]);
});

it('does not retain IDs between validations and still reports invalid items', () => {
  expect(v.safeParse(schema, [{id: 'same'}]).success).toBe(true);
  expect(v.safeParse(schema, [{id: 'same'}]).success).toBe(true);
  const result = v.safeParse(schema, [{id: 'same'}, {id: 2}]);
  expect(result.success).toBe(false);
  expect(result.issues?.[0]?.path?.map(part => part.key)).toEqual([1, 'id']);
});

it('keeps strict equality behavior for non-string IDs', () => {
  const generic = listWithUniqueIds(v.object({id: v.unknown()}));
  expect(v.safeParse(generic, [{id: NaN}]).success).toBe(false);
  expect(v.safeParse(generic, [{id: NaN}, {id: NaN}]).issues).toHaveLength(2);
  expect(v.safeParse(generic, [{id: 0}, {id: -0}]).success).toBe(false);
  const shared = {};
  expect(v.safeParse(generic, [{id: shared}, {id: shared}]).success).toBe(
    false,
  );
  expect(v.safeParse(generic, [{id: {}}, {id: {}}]).success).toBe(true);
});
