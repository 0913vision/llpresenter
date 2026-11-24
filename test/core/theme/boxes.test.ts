import {describe, expect, it} from 'vitest';
import {THEME_FILE_LIMITS, type ThemeFile} from '@core/schema/screens/theme';
import {
  addBox,
  boxNameProblem,
  changeBox,
  moveBox,
  removeBox,
} from '@core/theme/boxes';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {builtIn} from '@fixtures/core/themeOutput';

const title = builtIn(BUILT_IN_THEME_IDS.title);
const names = (theme: ThemeFile) => theme.boxes.map(box => box.name);
const drawn = (theme: ThemeFile) => JSON.stringify(theme.screens);

describe('the boxes of a theme', () => {
  it('are added under a free name up to the cap', () => {
    const once = addBox(title);
    if (once === null) throw new Error('No box');
    const twice = addBox(once.theme);
    expect(new Set(names(twice?.theme ?? title)).size).toBe(
      title.boxes.length + 2,
    );
    let full: ThemeFile = title;
    while (full.boxes.length < THEME_FILE_LIMITS.boxes) {
      const added = addBox(full);
      if (added === null) throw new Error('No box');
      full = added.theme;
    }
    expect(addBox(full)).toBeNull();
  });

  it('take their new name into every text that shows them', () => {
    const renamed = changeBox(title, '영문', box => ({...box, name: '부제'}));
    expect(names(renamed)).toContain('부제');
    expect(drawn(title)).toContain('{영문}');
    expect(drawn(renamed)).not.toContain('{영문}');
    expect(drawn(renamed)).toContain('{부제}');
  });

  it('leave with the texts that show nothing else', () => {
    const without = removeBox(title, '영문');
    expect(names(without)).not.toContain('영문');
    expect(drawn(without)).not.toContain('영문');
    expect(drawn(without)).toContain('{제목}');
  });

  it('change their order', () => {
    const [first, second] = names(title);
    expect(names(moveBox(title, first ?? '', 1)).slice(0, 2)).toEqual([
      second,
      first,
    ]);
    expect(moveBox(title, first ?? '', -1)).toBe(title);
  });
});

describe('boxNameProblem', () => {
  it('says why a name can not be used', () => {
    expect(boxNameProblem(title, ' ')).toBe('empty');
    expect(boxNameProblem(title, '{제목}')).toBe('brackets');
    expect(boxNameProblem(title, '제목')).toBe('taken');
    expect(boxNameProblem(title, '제목', '제목')).toBeUndefined();
    expect(boxNameProblem(title, '소제목')).toBeUndefined();
  });
});
