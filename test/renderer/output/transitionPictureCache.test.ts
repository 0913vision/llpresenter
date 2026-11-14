import {expect, it} from 'vitest';
import {TransitionPictureCache} from '@renderer/output/transitionPictureCache';

it('bounds compressed picture storage by bytes and evicts least recently used entries', () => {
  const cache = new TransitionPictureCache(12, 2);
  cache.put('a', 'aaa');
  cache.put('b', 'bbb');
  expect(cache.get('a')).toBe('aaa');
  cache.put('c', 'cc');
  expect(cache.get('b')).toBeUndefined();
  expect(cache.get('a')).toBe('aaa');
  expect(cache.get('c')).toBe('cc');
  expect(cache.bytes).toBe(10);
  cache.put('a', 'too long');
  expect(cache.get('a')).toBeUndefined();
  cache.clear();
  expect(cache.bytes).toBe(0);
  expect(cache.count).toBe(0);
});
