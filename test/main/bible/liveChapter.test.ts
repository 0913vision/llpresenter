import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {makeTempDir} from '@fixtures/tempDir';
import {loadBibleChapterLibrary} from '@main/bible/chapterLibrary';
import {BIBLE_VERSE_COUNTS} from '@core/bible/bibleVerseCounts';
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
  it('parses the site structure after malformed earlier markup', () => {
    const html =
      '<!doctype html><html><head><title>Example</title></head><body><a><div>heading</div></a><div id="tdBible1"><span><b class="number">1</b>alpha<font class="name">beta</font>gamma</span></div></body></html>';
    expect(parseLiveChapter(html)).toEqual(['alphabetagamma']);
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
  it('persists validated chapters across restarts and ignores corrupt cache files', async () => {
    const folder = await makeTempDir();
    const count = BIBLE_VERSE_COUNTS[0]?.[0];
    if (count === undefined) throw Error('Missing bounds');
    const page = `<div id="tdBible1">${Array.from(
      {length: count},
      (_, index) =>
        `<span><b class="number">${index + 1}</b>Verse ${index + 1}</span>`,
    ).join('')}</div>`;
    const fetch = vi.fn().mockResolvedValue({ok: true, text: async () => page});
    vi.stubGlobal('fetch', fetch);
    const first = await loadBibleChapterLibrary({
      folder,
      translations: [],
      onProblem: vi.fn(),
    });
    expect(await first.chapter(LIVE_BIBLE_ID, 1, 1)).toHaveLength(count);
    expect(
      JSON.parse(await readFile(join(folder, 'live', '1-1.json'), 'utf8')),
    ).toHaveLength(count);
    first.clear();
    const next = await loadBibleChapterLibrary({
      folder,
      translations: [],
      onProblem: vi.fn(),
    });
    expect(await next.cachedLiveChapter(1, 1)).toHaveLength(count);
    expect(fetch).toHaveBeenCalledTimes(1);
    next.clear();
    await writeFile(join(folder, 'live', '1-1.json'), '{bad');
    const damaged = await loadBibleChapterLibrary({
      folder,
      translations: [],
      onProblem: vi.fn(),
    });
    expect(await damaged.cachedLiveChapter(1, 1)).toBeNull();
    expect(await damaged.chapter(LIVE_BIBLE_ID, 1, 1)).toHaveLength(count);
    expect(fetch).toHaveBeenCalledTimes(2);
    damaged.clear();
  });
  it('keeps fetched live chapters across cache pressure and library refresh', async () => {
    const fetch = vi.fn().mockResolvedValue({ok: true, text: async () => html});
    vi.stubGlobal('fetch', fetch);
    const cache = new BibleChapterCache();
    const first = new BibleChapterLibrary([], () => {}, {cache});
    for (let chapter = 1; chapter <= 33; chapter++) {
      expect(await first.chapter(LIVE_BIBLE_ID, 1, chapter)).not.toBeNull();
    }
    first.clear(true);
    const second = new BibleChapterLibrary([], () => {}, {cache});
    expect(second.cachedChapter(LIVE_BIBLE_ID, 1, 1)).not.toBeNull();
    expect(await second.chapter(LIVE_BIBLE_ID, 1, 1)).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(33);
    second.clear();
  });
});
