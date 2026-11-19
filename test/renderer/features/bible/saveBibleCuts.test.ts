import {describe, expect, it, vi} from 'vitest';
import {confirmBibleCuts} from '@renderer/features/bible/saveBibleCuts';
import {entryFor, knownCutsFor} from '@core/bible/split/splitCache';
import {parseBibleCuts, serializeBibleCuts} from '@core/schema/bibleCuts';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

describe('confirmed cut writes', () => {
  it('confirms and reopens a verse with all 1,296 cuts', async () => {
    let current = settingsDocument('bibleCuts', {entries: {}});
    const get = vi.fn<LlpApi['settings']['get']>(async () => current);
    const edit = vi.fn<LlpApi['settings']['edit']>(async request => {
      if (request.type !== 'settings.update' || request.name !== 'bibleCuts') {
        throw new Error('Unexpected settings edit');
      }
      current = settingsDocument(
        'bibleCuts',
        request.value,
        current.revision + 1,
      );
      return {ok: true, value: {id: 'bibleCuts', revision: current.revision}};
    });
    const verse = {
      reference: {
        translation: lookupRequest().translation,
        book: 43,
        chapter: 3,
        verse: 16,
      },
      text: Array.from({length: 1_297}, () => '가').join(' '),
    };
    const cuts = Array.from({length: 1_296}, (_, index) => index + 1);
    await confirmBibleCuts({...mockLlpApi().settings, get, edit}, verse, cuts);
    if (current.name !== 'bibleCuts') throw new Error('Wrong settings');
    const serialized = serializeBibleCuts(current.value, 'bibleCuts.json');
    if (!serialized.ok) throw new Error('Could not save cuts');
    const reopened = parseBibleCuts(serialized.value, 'bibleCuts.json');
    if (!reopened.ok) throw new Error('Could not reopen cuts');
    expect(
      knownCutsFor(reopened.value.data, verse.reference, verse.text),
    ).toEqual(cuts);
  });
  it('serializes an eight-verse burst so each confirmation keeps earlier cuts', async () => {
    let current = settingsDocument('bibleCuts', {entries: {}});
    const get = vi.fn<LlpApi['settings']['get']>(async () => current);
    const edit = vi.fn<LlpApi['settings']['edit']>(async request => {
      if (request.type !== 'settings.update' || request.name !== 'bibleCuts') {
        throw new Error('Unexpected settings edit');
      }
      await Promise.resolve();
      if (request.baseRevision !== current.revision) {
        return {ok: false, error: {reason: 'stale', message: 'Stale'}};
      }
      current = settingsDocument(
        'bibleCuts',
        request.value,
        current.revision + 1,
      );
      return {ok: true, value: {id: 'bibleCuts', revision: current.revision}};
    });
    const api = {...mockLlpApi().settings, get, edit};
    const translation = lookupRequest().translation;
    const verses = Array.from({length: 8}, (_, index) => ({
      reference: {translation, book: 48, chapter: 5, verse: index + 1},
      text: `가 나 다 ${index}`,
    }));
    await Promise.all(verses.map(verse => confirmBibleCuts(api, verse, [1])));
    expect(edit).toHaveBeenCalledTimes(8);
    expect(current.name).toBe('bibleCuts');
    if (current.name !== 'bibleCuts') {
      throw new Error('Wrong settings document');
    }
    expect(Object.keys(current.value.entries[translation] ?? {})).toHaveLength(
      8,
    );
  });
  it('continues saving later confirmations after a failed write', async () => {
    const get = vi
      .fn<LlpApi['settings']['get']>()
      .mockResolvedValue(settingsDocument('bibleCuts', {entries: {}}));
    const edit = vi
      .fn<LlpApi['settings']['edit']>()
      .mockResolvedValueOnce({
        ok: false,
        error: {reason: 'read-only', message: 'Blocked'},
      })
      .mockResolvedValueOnce({ok: true, value: {id: 'bibleCuts', revision: 2}});
    const api = {...mockLlpApi().settings, get, edit};
    const reference = {
      translation: lookupRequest().translation,
      book: 48,
      chapter: 5,
      verse: 1,
    };
    const first = confirmBibleCuts(api, {reference, text: '가 나'}, [1]);
    const second = confirmBibleCuts(
      api,
      {reference: {...reference, verse: 2}, text: '다 라'},
      [1],
    );
    await expect(first).rejects.toThrow('절 나누기 저장 실패');
    const saved = await second;
    expect(edit).toHaveBeenCalledTimes(2);
    const request = edit.mock.calls[1]?.[0];
    if (request?.type !== 'settings.update' || request.name !== 'bibleCuts') {
      throw Error('Unexpected settings edit');
    }
    expect(saved.cuts).toEqual([1]);
    expect(
      request.value.entries[reference.translation]?.['48:5:1'],
    ).toBeUndefined();
    expect(request.value.entries[reference.translation]?.['48:5:2']).toEqual(
      saved,
    );
  });
  it('replaces an existing cut when the operator confirms a new one', async () => {
    const verse = {
      reference: {
        translation: lookupRequest().translation,
        book: 43,
        chapter: 3,
        verse: 16,
      },
      text: 'One two three',
    };
    const saved = entryFor(verse.text, [1], '2026-11-01T00:00:00.000Z');
    const get = vi.fn<LlpApi['settings']['get']>().mockResolvedValue(
      settingsDocument('bibleCuts', {
        entries: {[verse.reference.translation]: {'43:3:16': saved}},
      }),
    );
    const edit = vi
      .fn<LlpApi['settings']['edit']>()
      .mockResolvedValue({ok: true, value: {id: 'bibleCuts', revision: 2}});
    const api = {...mockLlpApi().settings, get, edit};
    await confirmBibleCuts(api, verse, [2]);
    expect(edit).toHaveBeenCalledOnce();
    const request = edit.mock.calls[0]?.[0];
    if (request?.type !== 'settings.update' || request.name !== 'bibleCuts') {
      throw Error('Unexpected settings edit');
    }
    expect(
      request.value.entries[verse.reference.translation]?.['43:3:16']?.cuts,
    ).toEqual([2]);
  });
  it('rereads after a stale edit and preserves another window confirmation', async () => {
    const first = settingsDocument('bibleCuts', {entries: {}});
    const second = settingsDocument(
      'bibleCuts',
      {
        entries: {
          krv: {
            '1:1:1': {
              hash: '12345678',
              cuts: [],
              confirmedAt: '2026-11-01T00:00:00.000Z',
            },
          },
        },
      },
      2,
    );
    const get = vi
      .fn<LlpApi['settings']['get']>()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(second);
    const edit = vi
      .fn<LlpApi['settings']['edit']>()
      .mockResolvedValueOnce({
        ok: false,
        error: {reason: 'stale', message: 'Stale'},
      })
      .mockResolvedValue({ok: true, value: {id: 'bibleCuts', revision: 3}});
    const api = {
      ...mockLlpApi().settings,
      get,
      edit,
      subscribe: vi.fn(() => () => undefined),
    };
    const verse = {
      reference: {
        translation: lookupRequest().translation,
        book: 43,
        chapter: 3,
        verse: 16,
      },
      text: '가 나 다',
    };
    await confirmBibleCuts(api, verse, [1]);
    expect(edit).toHaveBeenCalledTimes(2);
    expect(edit.mock.calls[1]?.[0]).toMatchObject({
      name: 'bibleCuts',
      baseRevision: 2,
      value: {
        entries: {
          krv: {'1:1:1': {hash: '12345678'}},
          [verse.reference.translation]: {'43:3:16': {cuts: [1]}},
        },
      },
    });
    expect(JSON.stringify(edit.mock.calls)).not.toContain(verse.text);
  });
});
