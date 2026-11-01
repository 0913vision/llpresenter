import {describe, expect, it, vi} from 'vitest';
import {
  DUPLICATE_TITLE_REASON,
  EMPTY_TITLE_REASON,
  SongTitleDraft,
} from '@core/songs/songTitle';

const RAW = `  ${'가사'.normalize('NFD')}  `;

describe('SongTitleDraft', () => {
  it('checks normalized duplicates while retaining the raw typing draft', () => {
    const duplicate = vi.fn(() => true);
    const draft = new SongTitleDraft('Original', duplicate);

    draft.edit(RAW);

    expect(draft.reason).toBe(DUPLICATE_TITLE_REASON);
    expect(duplicate).toHaveBeenLastCalledWith('가사');
    expect(draft.nextValue).toBe('Original');
  });

  it('keeps a newer trailing space through an older reply', () => {
    const draft = new SongTitleDraft('Original');
    draft.edit(RAW);
    draft.edit(`${RAW} `);

    draft.accept('가사', RAW);

    expect(draft.value).toBe(`${RAW} `);
    expect(draft.changed).toBe(false);
  });

  it.each(['', '   '])(
    'refuses the empty title %j and keeps the saved one',
    value => {
      const draft = new SongTitleDraft('Original');

      draft.edit(value);

      expect(draft.reason).toBe(EMPTY_TITLE_REASON);
      expect(draft.nextValue).toBe('Original');
    },
  );
});
