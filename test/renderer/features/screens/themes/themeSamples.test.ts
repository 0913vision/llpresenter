import {describe, expect, it} from 'vitest';
import {SECTION_THEMES} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {themeSamplesFor} from '@renderer/features/screens/themes/themeSamples';

describe('theme editor sample text', () => {
  it('uses field names for every section card theme', () => {
    for (const theme of SECTION_THEMES) {
      expect(themeSamplesFor(theme.id)).toMatchObject({
        itemName: '\ubb35\uc0c1\uae30\ub3c4',
        currentText: 'MEDITATION',
      });
    }
  });
  it('uses meaningful generic content', () => {
    expect(themeSamplesFor(undefined)).toMatchObject({
      reference: '\uc694\ud55c\ubcf5\uc74c 3:16',
      itemName: '\ud568\uaed8 \ub178\ub798\ud569\ub2c8\ub2e4',
      stageMessage:
        '\ub2e4\uc74c \uc21c\uc11c\ub97c \uc900\ube44\ud574 \uc8fc\uc138\uc694',
    });
  });
  it('uses sermon title fields instead of song lyrics', () => {
    expect(themeSamplesFor(SERMON_TITLE_THEME_ID)).toMatchObject({
      itemName: '\uc694\ud55c\ubcf5\uc74c 3:16',
      currentText: '\uc124\uad50 \uc81c\ubaa9',
    });
  });
});
