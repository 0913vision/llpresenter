import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  fetchLiveChapter,
  parseLiveChapter,
} from '../../../src/main/bible/liveChapter';
import {BibleChapterLibrary} from '../../../src/main/bible/chapterLibrary';
import {BibleChapterCache} from '../../../src/main/bible/chapterCache';
import {BibleLibrary} from '../../../src/main/bible/library';
import {LIVE_BIBLE_ID} from '../../../src/core/bible/liveTranslation';

const html =
  '<div id="tdBible1"><f><span><b class="number">1</b>alpha<font class="name">beta</font>gamma<div>heading</div><font size="2">footnote</font>&amp;delta</span><span><b class="number">3</b>last</span></f></div>';
afterEach(() => vi.unstubAllGlobals());
describe('live Bible chapters', () => {
  it('cleans wrapped verses without adding spaces and preserves missing verse slots', () => {
    expect(parseLiveChapter(html)).toEqual([
      'alphabetagamma&delta',
      '',
      'last',
    ]);
    expect(
      parseLiveChapter(
        '<div id="tdBible1"><span><b class="number">1</b>one</span></div>',
      ),
    ).toEqual(['one']);
  });
  it('handles HTTP, network and missing verse failures', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ok: false})
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ok: true, text: async () => '<html></html>'});
    vi.stubGlobal('fetch', fetch);
    expect(await fetchLiveChapter(43, 15)).toBeNull();
    expect(await fetchLiveChapter(43, 15)).toBeNull();
    expect(await fetchLiveChapter(43, 15)).toBeNull();
    expect(fetch.mock.calls[0]?.[0]).toContain('book=jhn&chap=15');
  });
  it('retries failures and caches successful chapters only for the session', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ok: true, text: async () => html});
    vi.stubGlobal('fetch', fetch);
    const library = new BibleChapterLibrary([], () => {});
    expect(await library.chapter(LIVE_BIBLE_ID, 43, 15)).toBeNull();
    expect(await library.chapter(LIVE_BIBLE_ID, 43, 15)).toEqual([
      'alphabetagamma&delta',
      '',
      'last',
    ]);
    expect(await library.chapter(LIVE_BIBLE_ID, 43, 15)).toEqual([
      'alphabetagamma&delta',
      '',
      'last',
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    library.clear();
  });
  it('reads only cached live chapters during service refresh', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, text: async () => html});
    vi.stubGlobal('fetch', fetch);
    const library = new BibleLibrary(new BibleChapterLibrary([], () => {}));
    const input = '\uC694\uD55C\uBCF5\uC74C 15:1';
    expect((await library.resolve(LIVE_BIBLE_ID, input, true)).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect((await library.resolve(LIVE_BIBLE_ID, input)).ok).toBe(true);
    expect((await library.resolve(LIVE_BIBLE_ID, input, true)).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    library.clear();
  });
  it('keeps fetched live chapters across cache pressure and library refresh', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, text: async () => html});
    vi.stubGlobal('fetch', fetch);
    const cache = new BibleChapterCache();
    const first = new BibleChapterLibrary([], () => {}, cache);
    for (let chapter = 1; chapter <= 33; chapter++) {
      expect(await first.chapter(LIVE_BIBLE_ID, 1, chapter)).not.toBeNull();
    }
    first.clear(true);
    const second = new BibleChapterLibrary([], () => {}, cache);
    expect(second.cachedChapter(LIVE_BIBLE_ID, 1, 1)).not.toBeNull();
    expect(await second.chapter(LIVE_BIBLE_ID, 1, 1)).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(33);
    second.clear();
  });
});
