import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readPictureSource} from '@renderer/platform/pictureSource';

const fetchPicture = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchPicture.mockReset();
  vi.stubGlobal('fetch', fetchPicture);
});

afterEach(() => vi.unstubAllGlobals());

describe('local picture source', () => {
  it.each([
    ['llp-media://media/photo', 'GET'],
    ['llp-media://thumbnail/photo?v=abc', 'HEAD'],
  ] as const)(
    'reads %s with %s and refuses redirects',
    async (source, method) => {
      const response = new Response(null);
      fetchPicture.mockResolvedValue(response);
      expect(await readPictureSource(source, method)).toBe(response);
      expect(fetchPicture).toHaveBeenCalledExactlyOnceWith(source, {
        method,
        cache: 'no-store',
        redirect: 'error',
      });
    },
  );

  it.each([
    'https://example.com/photo.png',
    'file:///photo.png',
    'llp-media://analysis/photo',
    'llp-media://media/',
    'llp-media://media/photo/other',
  ])('refuses %s without making a request', async source => {
    await expect(readPictureSource(source)).rejects.toThrow(
      'Invalid local picture source',
    );
    expect(fetchPicture).not.toHaveBeenCalled();
  });

  it('reports a failed local read', async () => {
    fetchPicture.mockResolvedValue(new Response(null, {status: 404}));
    await expect(
      readPictureSource('llp-media://media/missing'),
    ).rejects.toThrow('Could not read local picture source');
  });
});
