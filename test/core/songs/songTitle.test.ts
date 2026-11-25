import {describe, expect, it} from 'vitest';
import {
  copyTitle,
  DUPLICATE_TITLE_REASON,
  EMPTY_TITLE_REASON,
  LONG_TITLE_REASON,
  songTitleReason,
} from '@core/songs/songTitle';

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

describe('songTitleReason', () => {
  const songs = [
    {id: 'a', title: '만복의 근원 하나님'},
    {id: 'b', title: '내가 매일 기쁘게'},
  ];

  it('refuses a blank or too long title, and the title of another song', () => {
    expect(songTitleReason('  ', 'a', songs)).toBe(EMPTY_TITLE_REASON);
    expect(songTitleReason('가'.repeat(201), 'a', songs)).toBe(
      LONG_TITLE_REASON,
    );
    expect(songTitleReason(' 내가 매일 기쁘게 ', 'a', songs)).toBe(
      DUPLICATE_TITLE_REASON,
    );
  });

  it('lets a song keep its own title, and takes a new one', () => {
    expect(songTitleReason('만복의 근원 하나님', 'a', songs)).toBeUndefined();
    expect(songTitleReason('가'.repeat(200), 'a', songs)).toBeUndefined();
  });
});
