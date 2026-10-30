import {expect, it} from 'vitest';
import * as v from 'valibot';
import {uniqueNames} from './uniqueNames';

const schema = v.pipe(
  v.array(v.object({name: v.string()})),
  uniqueNames<{name: string}>('Repeated name'),
);

it('validates a large list and reports each duplicate at its original position', () => {
  const items = Array.from({length: 10_000}, (_, index) => ({
    name: `Invented ${index}`,
  }));
  expect(v.safeParse(schema, items).success).toBe(true);
  const result = v.safeParse(schema, [
    ...items,
    {name: 'Invented 0'},
    {name: 'Invented 9999'},
  ]);
  expect(result.success).toBe(false);
  expect(
    result.issues?.map(issue => ({
      message: issue.message,
      index: issue.path?.[0]?.key,
    })),
  ).toEqual([
    {message: 'Repeated name', index: 10_000},
    {message: 'Repeated name', index: 10_001},
  ]);
});

it('treats names as exact strings and does not retain state between calls', () => {
  const items = [{name: 'Verse'}, {name: 'verse'}, {name: ' Verse'}];
  expect(v.safeParse(schema, items).success).toBe(true);
  expect(v.safeParse(schema, items).success).toBe(true);
  const invalid = v.safeParse(schema, [{name: 'Verse'}, {name: 1}]);
  expect(invalid.issues?.[0]?.path?.map(part => part.key)).toEqual([1, 'name']);
});
