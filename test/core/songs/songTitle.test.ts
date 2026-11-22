import {describe, expect, it} from 'vitest';
import {copyTitle} from '@core/songs/songTitle';

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
