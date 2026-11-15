import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {newSectionItem} from '@core/services/sectionCards';
import {newSlidesItem} from '@core/services/slidesEdits';
import {canChooseItemTheme} from '@core/themes/sectionThemeChoices';
import {SECTION_THEMES, SUNDAY_SECTIONS} from '@core/themes/sundaySections';

describe('section theme choices', () => {
  it('offers section themes to standalone cards but not ordinary slides', () => {
    const id = createServiceItemId('00000000-0000-4000-8000-000000000001');
    const card = newSectionItem(id, SUNDAY_SECTIONS[0]!);
    const slides = newSlidesItem('blank', id);
    for (const theme of SECTION_THEMES) {
      expect(canChooseItemTheme(card, theme.id)).toBe(true);
      expect(canChooseItemTheme(slides, theme.id)).toBe(false);
      expect(
        canChooseItemTheme(
          {...slides, sectionCard: card.sectionCard!},
          theme.id,
        ),
      ).toBe(false);
    }
  });
});
