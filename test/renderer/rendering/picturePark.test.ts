import {expect, it, vi} from 'vitest';
import {PicturePark} from '@renderer/rendering/picturePark';

function view() {
  return {dispose: vi.fn()};
}

it('returns a parked picture once by what it shows', () => {
  const park = new PicturePark<ReturnType<typeof view>>(4);
  const first = view();
  park.park('a', first);
  expect(park.take('b')).toBeUndefined();
  expect(park.take('a')).toBe(first);
  expect(park.take('a')).toBeUndefined();
  expect(park.count).toBe(0);
  expect(first.dispose).not.toHaveBeenCalled();
});

it('disposes the oldest pictures past the limit', () => {
  const park = new PicturePark<ReturnType<typeof view>>(2);
  const [a, b, c] = [view(), view(), view()];
  park.park('a', a);
  park.park('b', b);
  park.park('c', c);
  expect(a.dispose).toHaveBeenCalledTimes(1);
  expect(park.count).toBe(2);
  expect(park.take('a')).toBeUndefined();
  expect(park.take('c')).toBe(c);
  expect(b.dispose).not.toHaveBeenCalled();
});

it('keeps two pictures that show the same thing', () => {
  const park = new PicturePark<ReturnType<typeof view>>(3);
  const [a, b] = [view(), view()];
  park.park('same', a);
  park.park('same', b);
  expect(park.take('same')).toBe(b);
  expect(park.take('same')).toBe(a);
});
