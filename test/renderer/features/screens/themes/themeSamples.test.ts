import {describe, expect, it} from 'vitest';
import {SECTION_THEMES} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {themeSamplesFor} from '@renderer/features/screens/themes/themeSamples';

describe('theme editor sample text', () => {
  it('uses field names for every section card theme', () => {
    for (const theme of SECTION_THEMES) {
      expect(themeSamplesFor(theme.id)).toMatchObject({
        itemName: '묵상기도',
        currentText: 'MEDITATION',
      });
    }
  });
  it('uses meaningful generic content', () => {
    expect(themeSamplesFor(undefined)).toMatchObject({
      reference: '요한복음 3:16',
      itemName: '함께 노래합니다',
      stageMessage: '다음 순서를 준비해 주세요',
    });
  });
  it('uses sermon title fields instead of song lyrics', () => {
    expect(themeSamplesFor(SERMON_TITLE_THEME_ID)).toMatchObject({
      itemName: '요한복음 3:16',
      currentText: '설교 제목',
    });
  });
});
