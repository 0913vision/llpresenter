import {describe, expect, it} from 'vitest';
import {MEDIA_SCHEME, mediaIdFromUrl, mediaUrl} from './media';

describe('mediaUrl', () => {
  it('puts the encoded id after llp-media://media/', () => {
    expect(mediaUrl('3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293')).toBe(
      'llp-media://media/3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293',
    );
    expect(mediaUrl('따뜻한 빛/1')).toBe(
      `${MEDIA_SCHEME}://media/${encodeURIComponent('따뜻한 빛/1')}`,
    );
  });
});

describe('mediaIdFromUrl', () => {
  it('reads back every id that mediaUrl writes', () => {
    for (const id of ['abc', '따뜻한 빛', 'a/b', '100%', '?#&=', ' ']) {
      expect(mediaIdFromUrl(mediaUrl(id))).toBe(id);
    }
  });

  it.each([
    ['another scheme', 'file:///C:/media/a.mp4'],
    ['another host', 'llp-media://files/abc'],
    ['no id', 'llp-media://media/'],
    ['an extra path segment', 'llp-media://media/a/b'],
    ['a query', 'llp-media://media/abc?x=1'],
    ['a fragment', 'llp-media://media/abc#t=5'],
    ['a malformed escape', 'llp-media://media/%E0%A4%A'],
    ['text that is not a URL', 'not a url'],
  ])('returns null for %s', (_name, url) => {
    expect(mediaIdFromUrl(url)).toBeNull();
  });
});
