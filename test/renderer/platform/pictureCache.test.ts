import {describe, expect, it, vi} from 'vitest';
import {
  PictureCache,
  type PictureRequest,
} from '@renderer/platform/pictureCache';

const request: PictureRequest = {
  source: 'photo',
  width: 448,
  height: 256,
  fit: 'cover',
};

function setup(maxBytes = 100, maxEntries = 10) {
  const stamp = vi.fn(async () => 'version1');
  let copies = 0;
  const make = vi.fn(async () => ({url: `blob:${++copies}`, bytes: 40}));
  const release = vi.fn();
  const cache = new PictureCache({stamp, make, release, maxBytes, maxEntries});
  return {cache, stamp, make, release};
}

describe('PictureCache', () => {
  it('coalesces concurrent source and size requests and reuses a checked copy', async () => {
    const {cache, make} = setup();
    expect(await Promise.all([cache.get(request), cache.get(request)])).toEqual(
      ['blob:1', 'blob:1'],
    );
    expect(await cache.get(request)).toBe('blob:1');
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('evicts the least recently used copy to stay under its byte cap', async () => {
    const {cache, release} = setup();
    await cache.get(request);
    await cache.get({...request, source: 'second'});
    await cache.get(request);
    await cache.get({...request, source: 'third'});
    expect(release).toHaveBeenCalledExactlyOnceWith('blob:2');
    expect(await cache.get(request)).toBe('blob:1');
  });

  it('also caps the entry count and releases everything on disposal', async () => {
    const {cache, release} = setup(1000, 1);
    await cache.get(request);
    await cache.get({...request, width: 640});
    expect(release).toHaveBeenCalledWith('blob:1');
    cache.dispose();
    expect(release).toHaveBeenCalledWith('blob:2');
    expect(await cache.get(request)).toBe('photo');
  });

  it('invalidates a copy when the source file stamp changes', async () => {
    const {cache, stamp, release} = setup();
    await cache.get(request);
    await cache.get({...request, width: 640});
    stamp.mockResolvedValue('version2');
    expect(await cache.get(request)).toBe('blob:3');
    expect(release).toHaveBeenCalledWith('blob:1');
    expect(release).toHaveBeenCalledWith('blob:2');
  });

  it('does not publish a copy replaced during decoding', async () => {
    const {cache, stamp, release} = setup();
    stamp.mockResolvedValueOnce('version1').mockResolvedValue('version2');
    expect(await cache.get(request)).toBe('photo');
    expect(release).toHaveBeenCalledExactlyOnceWith('blob:1');
  });

  it('refuses an oversized copy and recovers after a decoder failure', async () => {
    const {cache, make, release} = setup(30);
    make.mockRejectedValueOnce(new Error('decode failed'));
    await expect(cache.get(request)).rejects.toThrow('decode failed');
    expect(await cache.get(request)).toBe('photo');
    expect(release).toHaveBeenCalledExactlyOnceWith('blob:1');
  });

  it('releases the copy if source validation fails after decoding', async () => {
    const {cache, stamp, release} = setup();
    stamp
      .mockResolvedValueOnce('version1')
      .mockRejectedValueOnce(new Error('missing'));
    await expect(cache.get(request)).rejects.toThrow('missing');
    expect(release).toHaveBeenCalledExactlyOnceWith('blob:1');
  });

  it('does not retain a copy completed after disposal', async () => {
    const {cache, make, release} = setup();
    make.mockImplementationOnce(async () => {
      cache.dispose();
      return {url: 'blob:late', bytes: 40};
    });
    expect(await cache.get(request)).toBe('photo');
    expect(release).toHaveBeenCalledExactlyOnceWith('blob:late');
  });
});
