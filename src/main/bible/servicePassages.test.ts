import {describe, expect, it, vi} from 'vitest';
import {
  parseBibleLookupRequest,
  type BibleLookupReply,
} from '@shared/schema/bibleLookup';
import {createServiceItemId} from '@shared/schema/ids';
import type {ServiceItem} from '@shared/schema/service';
import {isItemOfKind} from '@shared/schema/service';
import {SHOW_SERVICE_LIMITS} from '@shared/schema/showService';
import {resolvePassage} from './reference';
import {passageSource} from './testFiles';
import {resolveServicePassages} from './servicePassages';
import type {BibleLookupSession} from './lookup';

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
  it('keeps each saved passage reference frequency on its projected tiles', async () => {
    const original = items('요한복음 3:16-18')[0];
    if (original === undefined || !isItemOfKind(original, 'bible')) {
      throw new Error('Missing Bible fixture');
    }
    for (const frequency of ['every', 'first', 'none'] as const) {
      const row = {
        ...original,
        bible: {...original.bible, reference: frequency},
      };
      const result = await resolveServicePassages([row], fixture(), {
        reportError: vi.fn(),
      });
      expect(result.tiles.get(row.id)?.map(tile => tile.reference)).toEqual(
        frequency === 'every'
          ? ['3:16', '3:17', '3:18']
          : frequency === 'first'
            ? ['3:16', undefined, undefined]
            : [undefined, undefined, undefined],
      );
    }
  });
  it('exposes normalized identity only for successfully resolved saved items', async () => {
    const bible = fixture();
    const rows = items('John 3 : 16 - 18', '창세기 1:1');
    const result = await resolveServicePassages(rows, bible, {
      reportError: bible.report,
    });
    expect([...result.references]).toEqual([
      [rows[0]?.id, {ref: '요한복음 3:16-18', translation: 'sample'}],
    ]);
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
      {label: '3:16', lines: ['16 Invented book 43, chapter 3, verse 16']},
      {label: '3:17'},
      {label: '3:18'},
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
