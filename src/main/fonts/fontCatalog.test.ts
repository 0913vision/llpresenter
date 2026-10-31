import {expect, it, vi} from 'vitest';
import type {FontCatalog} from '@core/schema/fontCatalog';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import {FontCatalogCache} from './fontCatalog';

it('coalesces reads, refreshes expired data, and retains the last good list after failure', async () => {
  let now = 0;
  let finish: (value: FontCatalog) => void = () => undefined;
  const read = vi
    .fn<(signal: AbortSignal) => Promise<FontCatalog>>()
    .mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
  const log = {warn: vi.fn()};
  const cache = new FontCatalogCache({read, log, now: () => now});
  const first = cache.get();
  expect(cache.get()).toBe(first);
  const value = [fontFamilyFixture()];
  finish(value);
  expect(await first).toBe(value);
  expect(await cache.get()).toBe(value);
  expect(read).toHaveBeenCalledOnce();
  now = 60_001;
  read.mockRejectedValueOnce(new Error('Native reader failed'));
  expect(await cache.get()).toBe(value);
  expect(await cache.get()).toBe(value);
  expect(log.warn).toHaveBeenCalledOnce();
  expect(read).toHaveBeenCalledTimes(2);
  now += 10_001;
  const updated = [{...fontFamilyFixture(), weights: [400]}];
  read.mockResolvedValueOnce(updated);
  expect(await cache.get()).toBe(updated);
  cache.dispose();
});

it('bounds retries after an initial synchronous failure', async () => {
  let now = 0;
  const read = vi
    .fn<(signal: AbortSignal) => Promise<FontCatalog>>()
    .mockImplementation(() => {
      throw new Error('Native reader failed');
    });
  const cache = new FontCatalogCache({
    read,
    log: {warn: vi.fn()},
    now: () => now,
  });
  await expect(cache.get()).rejects.toThrow('Could not read installed fonts');
  await expect(cache.get()).rejects.toThrow('Could not read installed fonts');
  expect(read).toHaveBeenCalledOnce();
  now = 10_001;
  read.mockResolvedValueOnce([]);
  expect(await cache.get()).toEqual([]);
  cache.dispose();
});

it('aborts a pending query and prevents late results from reviving the cache', async () => {
  let finish: (value: FontCatalog) => void = () => undefined;
  const read = vi
    .fn<(signal: AbortSignal) => Promise<FontCatalog>>()
    .mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
  const cache = new FontCatalogCache({read, log: {warn: vi.fn()}});
  const pending = cache.get();
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
  cache.dispose();
  expect(read.mock.calls[0]?.[0].aborted).toBe(true);
  finish([fontFamilyFixture()]);
  await expect(pending).rejects.toThrow('Font catalog is closed');
  await expect(cache.get()).rejects.toThrow('Font catalog is closed');
});
