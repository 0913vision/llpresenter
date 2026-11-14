import {describe, expect, it, vi} from 'vitest';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {
  parseBibleLookupRequest,
  type BibleLookupReply,
} from '@core/schema/bibleLookup';
import {createServiceItemId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {SHOW_SERVICE_LIMITS} from '@core/schema/showService';
import {resolvePassage} from '@core/bible/reference';
import {passageSource} from '@fixtures/core/bible/testFiles';
import {resolveServicePassages} from '@main/bible/servicePassages';
import type {BibleLookupSession} from '@main/bible/lookup';
import {
  slidesBibleItem,
  VERSE_SLIDE,
  VERSE_REPEAT,
} from '@fixtures/core/slidesBible';

function items(...refs: readonly string[]): readonly ServiceItem[] {
  const request = parseBibleLookupRequest({translation: 'sample', input: ''});
  if (!request.ok) throw new Error('Invalid test translation');
  return refs.map((ref, index) => ({
    id: createServiceItemId(
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ),
    bible: {
      translation: request.value.translation,
      ref,
      split: 'verse',
      reference: 'every',
      verseNumbers: index === 0,
      translationName: false,
    },
  }));
}

function fixture() {
  const source = passageSource();
  const lookup = vi.fn<BibleLookupSession['lookup']>(async request => ({
    ...request,
    suggestions: [],
    result: await resolvePassage(source, request.input),
  }));
  const report = vi.fn();
  return {lookup, report};
}

describe('saved Bible passage resolution', () => {
  it('uses cache-only lookup for live translations during service refresh', async () => {
    const item = items('\uC694\uD55C\uBCF5\uC74C 3:16')[0];
    if (!item || !isItemOfKind(item, 'bible')) {
      throw Error('Missing Bible fixture');
    }
    const bible = fixture();
    await resolveServicePassages(
      [{...item, bible: {...item.bible, translation: LIVE_BIBLE_ID}}],
      bible,
      {reportError: bible.report},
    );
    expect(bible.lookup).toHaveBeenCalledWith(
      {translation: LIVE_BIBLE_ID, input: item.bible.ref},
      true,
    );
  });
  it('resolves reference-only verse slots, deduplicates repeated verses and retains them beside an unavailable verse', async () => {
    const item = slidesBibleItem();
    const bible = fixture();
    const original = item.slides.slides[2];
    if (original === undefined || !('verse' in original)) {
      throw Error('Missing verse fixture');
    }
    const invalid = {
      ...item,
      slides: {
        ...item.slides,
        slides: item.slides.slides.map(slide =>
          slide === original
            ? {...original, verse: {...original.verse, chapter: 150}}
            : slide,
        ),
      },
    };
    const result = await resolveServicePassages([invalid], bible, {
      reportError: bible.report,
    });
    expect(bible.lookup).toHaveBeenCalledTimes(2);
    expect(result.slides?.get(item.id)?.get(VERSE_SLIDE)?.verses).toHaveLength(
      1,
    );
    expect(result.slides?.get(item.id)?.get(VERSE_REPEAT)).toEqual(
      result.slides?.get(item.id)?.get(VERSE_SLIDE),
    );
    expect(result.unavailable.has(item.id)).toBe(true);
    expect(result.tiles.has(item.id)).toBe(false);
  });
  it('draws the saved translation option with the lookup translation label', async () => {
    const original = items('요한복음 3:16-18')[0];
    if (!original || !isItemOfKind(original, 'bible')) {
      throw Error('Missing Bible fixture');
    }
    const bible = fixture();
    const lookup = bible.lookup.getMockImplementation();
    if (!lookup) throw Error('Missing lookup fixture');
    bible.lookup.mockImplementation(async request => {
      const reply = await lookup(request);
      return {
        ...reply,
        result: reply.result.ok
          ? {
              ok: true,
              value: {...reply.result.value, translationLabel: '개역한글'},
            }
          : reply.result,
      };
    });
    for (const translationName of [true, false]) {
      const row = {
        ...original,
        bible: {...original.bible, split: 'two' as const, translationName},
      };
      const result = await resolveServicePassages([row], bible, {
        reportError: vi.fn(),
      });
      expect(result.tiles.get(row.id)?.[0]?.reference).toBe(
        `요한복음 3:16${translationName ? ' (개역한글)' : ''}`,
      );
    }
  });
  it('keeps each saved passage reference frequency on its projected tiles', async () => {
    const original = items('요한복음 3:16-18')[0];
    if (original === undefined || !isItemOfKind(original, 'bible')) {
      throw new Error('Missing Bible fixture');
    }
    for (const frequency of ['every', 'first', 'last', 'none'] as const) {
      const row = {
        ...original,
        bible: {...original.bible, reference: frequency},
      };
      const result = await resolveServicePassages([row], fixture(), {
        reportError: vi.fn(),
      });
      expect(result.tiles.get(row.id)?.map(tile => tile.reference)).toEqual(
        frequency === 'every'
          ? ['요한복음 3:16', '요한복음 3:17', '요한복음 3:18']
          : frequency === 'first'
            ? ['요한복음 3:16', undefined, undefined]
            : frequency === 'last'
              ? [undefined, undefined, '요한복음 3:18']
              : [undefined, undefined, undefined],
      );
    }
  });

  it('starts each saved verse on a slide, including legacy packing values', async () => {
    const original = items('요한복음 3:16-18')[0];
    if (original === undefined || !isItemOfKind(original, 'bible')) {
      throw new Error('Missing Bible fixture');
    }
    const built = async (split: 'verse' | 'two' | 'fit') => {
      const row = {...original, bible: {...original.bible, split}};
      const result = await resolveServicePassages([row], fixture(), {
        reportError: vi.fn(),
      });
      return result.tiles.get(row.id)?.map(tile => tile.label);
    };
    expect(await built('verse')).toEqual([
      '\uC6943:16',
      '\uC6943:17',
      '\uC6943:18',
    ]);
    expect(await built('two')).toEqual([
      '\uC6943:16',
      '\uC6943:17',
      '\uC6943:18',
    ]);
    expect(await built('fit')).toEqual([
      '\uC6943:16',
      '\uC6943:17',
      '\uC6943:18',
    ]);
  });
  it('exposes normalized identity only for successfully resolved saved items', async () => {
    const bible = fixture();
    const rows = items('John 3 : 16 - 18', '창세기 1:1');
    const result = await resolveServicePassages(rows, bible, {
      reportError: bible.report,
    });
    expect([...result.references.keys()]).toEqual([rows[0]?.id]);
    const resolved = result.references.get(rows[0]?.id ?? '');
    expect(resolved).toMatchObject({
      ref: '요한복음 3:16-18',
      translation: 'sample',
    });
    expect(resolved?.passage?.verses).toHaveLength(3);
    expect(result.unavailable.has(rows[1]?.id ?? '')).toBe(true);
  });

  it('deduplicates reference reads while retaining item identity and verse-number choices', async () => {
    const bible = fixture();
    const rows = items('요한복음 3:16-18', '요한복음 3:16-18');
    const result = await resolveServicePassages(rows, bible, {
      reportError: bible.report,
    });
    expect(bible.lookup).toHaveBeenCalledOnce();
    expect([...result.tiles.keys()]).toEqual(rows.map(row => row.id));
    expect(result.tiles.get(rows[0]?.id ?? '')).toMatchObject([
      {
        label: '\uC6943:16',
        lines: ['16 Invented book 43, chapter 3, verse 16'],
      },
      {label: '\uC6943:17'},
      {label: '\uC6943:18'},
    ]);
    expect(result.tiles.get(rows[1]?.id ?? '')?.[0]?.lines).toEqual([
      'Invented book 43, chapter 3, verse 16',
    ]);
    expect(result.unavailable.size).toBe(0);
  });

  it('isolates an unavailable book and a rejected read without dropping later passages', async () => {
    const bible = fixture();
    const rows = items('창세기 1:1', '요한복음 1:1', '요한복음 3:16');
    const lookup = bible.lookup.getMockImplementation();
    if (!lookup) throw new Error('Missing fixture lookup');
    bible.lookup
      .mockImplementationOnce(lookup)
      .mockRejectedValueOnce(new Error('Invented read failure'));
    const result = await resolveServicePassages(rows, bible, {
      reportError: bible.report,
    });
    expect([...result.unavailable]).toEqual(
      rows.slice(0, 2).map(row => row.id),
    );
    expect([...result.tiles.keys()]).toEqual([rows[2]?.id]);
    expect(bible.report).toHaveBeenCalledOnce();
  });

  it('rejects a stored reference beyond the IPC input limit before reading it', async () => {
    const bible = fixture();
    const rows = items('x'.repeat(257));
    const result = await resolveServicePassages(rows, bible, {
      reportError: bible.report,
    });
    expect(bible.lookup).not.toHaveBeenCalled();
    expect([...result.unavailable]).toEqual(rows.map(row => row.id));
  });

  it('never emits a partial tile sequence above the service projection cap', async () => {
    const bible = fixture();
    const rows = items('요한복음 3:16');
    bible.lookup.mockImplementationOnce(async request => ({
      ...request,
      suggestions: [],
      result: {
        ok: true,
        value: {
          translation: request.translation,
          ref: request.input,
          displayRef: request.input,
          verses: Array.from(
            {length: SHOW_SERVICE_LIMITS.tiles + 1},
            (_, index) => ({chapter: 1, verse: index + 1, text: 'Invented'}),
          ),
        },
      },
    }));
    const result = await resolveServicePassages(rows, bible, {
      reportError: bible.report,
    });
    expect(result.tiles.size).toBe(0);
    expect(result.references.size).toBe(0);
    expect([...result.unavailable]).toEqual(rows.map(row => row.id));
  });

  it('stops scheduling reads when a refresh is superseded or disposed', async () => {
    const bible = fixture();
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    const pending = new Promise<BibleLookupReply>(resolve => {
      finish = resolve;
    });
    const request = parseBibleLookupRequest({
      translation: 'sample',
      input: '요한복음 3:16',
    });
    if (!request.ok) throw new Error('Invalid request fixture');
    const answer = await bible.lookup(request.value);
    bible.lookup.mockClear();
    bible.lookup.mockReturnValueOnce(pending);
    let current = true;
    const resolving = resolveServicePassages(
      items('요한복음 3:16', '요한복음 3:17'),
      bible,
      {reportError: bible.report, isCurrent: () => current},
    );
    current = false;
    finish(answer);
    await resolving;
    expect(bible.lookup).toHaveBeenCalledOnce();
  });
});
