import {afterEach, expect, it, vi} from 'vitest';
import {fontFamilyFixture} from '@fixtures/core/fontCatalog';
import {FontCatalogCache} from '@main/fonts/fontCatalog';

const stamp = 'a'.repeat(64);
const families = [fontFamilyFixture()];
const caches: FontCatalogCache[] = [];
function setup(saved = true, ready?: Promise<boolean>) {
  const options = {
    ...(ready === undefined ? {} : {ready}),
    load: vi.fn(async () => (saved ? {stamp, families} : null)),
    save: vi.fn(async () => undefined),
    stamp: vi.fn(async () => stamp),
    read: vi.fn(async () => families),
    changed: vi.fn(),
    log: {warn: vi.fn()},
  };
  const cache = new FontCatalogCache(options);
  caches.push(cache);
  return {cache, options};
}
afterEach(() => {
  for (const cache of caches.splice(0)) cache.dispose();
  vi.useRealTimers();
});

it.each([true, false])(
  'serves cached choices while native refresh waits for idle (continue=%s)',
  async ready => {
    let release: (value: boolean) => void = () => undefined;
    const gate = new Promise<boolean>(resolve => {
      release = resolve;
    });
    const {cache, options} = setup(true, gate);
    expect(await cache.snapshot()).toEqual({families, verified: false});
    expect(options.stamp).not.toHaveBeenCalled();
    release(ready);
    if (ready) await expect(cache.get()).resolves.toEqual(families);
    else await expect(cache.get()).rejects.toThrow('verify');
    expect(options.stamp).toHaveBeenCalledTimes(ready ? 1 : 0);
    expect(options.read).not.toHaveBeenCalled();
  },
);

it('serves persisted choices before stamp verification, coalescing readers without enumeration', async () => {
  const {cache, options} = setup();
  let finish: (value: string) => void = () => undefined;
  options.stamp.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  expect(await cache.snapshot()).toEqual({families, verified: false});
  expect(await cache.snapshot()).toEqual({families, verified: false});
  const first = cache.get();
  finish(stamp);
  expect(await first).toEqual(families);
  expect(await cache.snapshot()).toEqual({families, verified: true});
  expect(options.stamp).toHaveBeenCalledOnce();
  expect(options.read).not.toHaveBeenCalled();
});

it('keeps verification and subscribers unchanged during periodic checks of the same stamp', async () => {
  vi.useFakeTimers();
  const {cache, options} = setup();
  await cache.get();
  const verified = await cache.snapshot();
  options.changed.mockClear();
  let finish: (value: string) => void = () => undefined;
  options.stamp.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await cache.snapshot()).toBe(verified);
  expect(options.changed).not.toHaveBeenCalled();
  finish(stamp);
  await cache.get();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await cache.snapshot()).toBe(verified);
  expect(options.changed).not.toHaveBeenCalled();
  expect(options.read).not.toHaveBeenCalled();
});

it('downgrades a verified catalog as soon as its stamp changes, before enumeration finishes', async () => {
  vi.useFakeTimers();
  const {cache, options} = setup();
  await cache.get();
  options.changed.mockClear();
  options.stamp.mockResolvedValue('b'.repeat(64));
  let finish: (value: typeof families) => void = () => undefined;
  options.read.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await cache.snapshot()).toEqual({families, verified: false});
  expect(options.changed).toHaveBeenCalledExactlyOnceWith({
    families,
    verified: false,
  });
  finish([]);
  await expect(cache.get()).resolves.toEqual([]);
  expect(options.changed).toHaveBeenLastCalledWith({
    families: [],
    verified: true,
  });
});

it('downgrades on a failed periodic stamp check and verifies again on retry', async () => {
  vi.useFakeTimers();
  const {cache, options} = setup();
  await cache.get();
  options.changed.mockClear();
  options.stamp.mockRejectedValueOnce(Error('timeout'));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await cache.snapshot()).toEqual({families, verified: false});
  expect(options.changed).toHaveBeenCalledExactlyOnceWith({
    families,
    verified: false,
  });
  await expect(cache.get()).rejects.toThrow('verify');
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await cache.snapshot()).toEqual({families, verified: true});
  expect(options.read).not.toHaveBeenCalled();
});

it('invalidates a changed installation and atomically saves only a stable enumeration', async () => {
  const {cache, options} = setup();
  const changed = 'b'.repeat(64);
  options.stamp.mockResolvedValue(changed);
  options.read.mockResolvedValue([]);
  expect(await cache.get()).toEqual([]);
  expect(options.stamp).toHaveBeenCalledTimes(2);
  expect(options.save).toHaveBeenCalledWith({stamp: changed, families: []});
  expect(await cache.snapshot()).toEqual({families: [], verified: true});
});

it.each([true, false])(
  'never turns a timeout into missing fonts (saved=%s), and retries in the background',
  async saved => {
    vi.useFakeTimers();
    const {cache, options} = setup(saved);
    options.stamp.mockResolvedValue('b'.repeat(64));
    options.read.mockRejectedValueOnce(Error('timeout'));
    await expect(cache.get()).rejects.toThrow('verify');
    expect(await cache.snapshot()).toEqual({
      families: saved ? families : [],
      verified: false,
    });
    expect(options.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await cache.snapshot()).toEqual({families, verified: true});
    expect(options.read).toHaveBeenCalledTimes(2);
  },
);

it('rejects a scan that races a font installation and rechecks stamps periodically', async () => {
  vi.useFakeTimers();
  const {cache, options} = setup();
  await cache.get();
  options.stamp
    .mockResolvedValueOnce('b'.repeat(64))
    .mockResolvedValueOnce('c'.repeat(64));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await cache.snapshot()).toEqual({families, verified: false});
  expect(options.save).not.toHaveBeenCalled();
});

it('aborts shutdown work and ignores late native results', async () => {
  const {cache, options} = setup(false);
  let finish: (value: string) => void = () => undefined;
  options.stamp.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await cache.snapshot();
  const get = cache.get();
  cache.dispose();
  finish(stamp);
  await expect(get).rejects.toThrow('closed');
  expect(options.read).not.toHaveBeenCalled();
  expect(options.save).not.toHaveBeenCalled();
});

it('refuses malformed native metadata without establishing absence', async () => {
  const {cache, options} = setup(false);
  options.read.mockResolvedValue([{...fontFamilyFixture(), weights: [0]}]);
  await expect(cache.get()).rejects.toThrow('verify');
  expect(await cache.snapshot()).toEqual({families: [], verified: false});
  expect(options.save).not.toHaveBeenCalled();
});
