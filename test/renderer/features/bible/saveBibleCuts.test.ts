import {describe, expect, it, vi} from 'vitest';
import {confirmBibleCuts} from '@renderer/features/bible/saveBibleCuts';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

describe('confirmed cut writes', () => {
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
