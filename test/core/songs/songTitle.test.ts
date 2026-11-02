import {describe, expect, it, vi} from 'vitest';
import {
  DUPLICATE_TITLE_REASON,
  EMPTY_TITLE_REASON,
  SongTitleDraft,
  copyTitle,
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

describe('copyTitle', () => {
  it('names the copy 복사본 and skips the titles taken, comparing them normalized', () => {
    expect(copyTitle('새 아침', ['새 아침'])).toBe('새 아침 복사본');
    expect(copyTitle('  새 아침 ', ['새 아침 복사본'.normalize('NFD')])).toBe(
      '새 아침 복사본 2',
    );
    expect(copyTitle('새 아침', [])).toBe('새 아침 복사본');
  });

  it('keeps the copy within the longest title', () => {
    const title = '가'.repeat(200);

    expect(copyTitle(title, [])).toHaveLength(200);
  });
});
