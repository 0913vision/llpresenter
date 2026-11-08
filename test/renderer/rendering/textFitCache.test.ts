import {expect, it, vi} from 'vitest';
import {TextFitCache} from '@renderer/rendering/textFitCache';

it('reuses fits, keeps recent entries, and evicts the oldest at the cap', () => {
  const cache = new TextFitCache();
  const measure = vi.fn(() => 42);
  cache.fit('first', measure);
  cache.fit('second', measure);
  for (let i = 0; i < 510; i++) cache.fit(String(i), measure);
  expect(cache.fit('first', measure)).toBe(42);
  expect(measure).toHaveBeenCalledTimes(512);
  cache.fit('new', measure);
  cache.fit('first', measure);
  expect(measure).toHaveBeenCalledTimes(513);
  cache.fit('second', measure);
  expect(measure).toHaveBeenCalledTimes(514);
});

it('does not retain oversized text keys', () => {
  const cache = new TextFitCache();
  const measure = vi.fn(() => 10);
  cache.fit('x'.repeat(8193), measure);
  cache.fit('x'.repeat(8193), measure);
  expect(measure).toHaveBeenCalledTimes(2);
});

it('bypasses loading fonts and invalidates after another font load', () => {
  const cache = new TextFitCache();
  const mockFonts: {ready: Promise<unknown>; status: 'loading' | 'loaded'} = {
    ready: Promise.resolve(),
    status: 'loading',
  };
  const measure = vi.fn(() => 24);
  cache.fit('text', measure, mockFonts);
  cache.fit('text', measure, mockFonts);
  expect(measure).toHaveBeenCalledTimes(2);
  mockFonts.status = 'loaded';
  cache.fit('text', measure, mockFonts);
  cache.fit('text', measure, mockFonts);
  expect(measure).toHaveBeenCalledTimes(3);
  mockFonts.ready = Promise.resolve();
  cache.fit('text', measure, mockFonts);
  expect(measure).toHaveBeenCalledTimes(4);
});
