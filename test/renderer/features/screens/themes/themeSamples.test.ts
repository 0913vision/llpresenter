import {describe, expect, it} from 'vitest';
import {SECTION_THEMES} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {themeSamplesFor} from '@renderer/features/screens/themes/themeSamples';

describe('theme editor sample text', () => {
  it('uses field names for every section card theme', () => {
    for (const theme of SECTION_THEMES) {
      expect(themeSamplesFor(theme.id)).toMatchObject({
        itemName: '\uad6c\uc5ed \uc774\ub984',
        currentText: '\uc601\ubb38 \uc774\ub984',
      });
    }
  });
  it('uses sermon title fields instead of song lyrics', () => {
    expect(themeSamplesFor(SERMON_TITLE_THEME_ID)).toMatchObject({
      itemName: '\uc131\uacbd \uad6c\uc808',
      currentText: '\uc124\uad50 \uc81c\ubaa9',
    });
  });
});
