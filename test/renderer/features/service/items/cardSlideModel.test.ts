import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {
  bibleEditorSlides,
  setItemCard,
} from '@renderer/features/service/items/cardSlideModel';

const section = SUNDAY_SECTIONS[0];
if (section === undefined) throw Error('missing section');
const card = sectionCardOf(section);
const item = newSlidesItem(
  'blank',
  createServiceItemId('55000000-0000-4000-8000-000000000001'),
);

describe('item card slide model', () => {
  it('adds and removes the same card field used by item details', () => {
    const added = setItemCard(item, card);
    expect(added).toMatchObject({sectionCard: card, slides: item.slides});
    if (added === null) throw Error('missing item');
    const removed = setItemCard(added, undefined);
    expect(removed).toEqual(item);
    expect(setItemCard({id: item.id, header: 'Heading'}, card)).toBeNull();
  });

  it('projects one editable card before read-only Bible verses', () => {
    const verse = {label: '3:16', labelColor: 'none' as const, lines: ['Text']};
    const slides = bibleEditorSlides(card, [verse]);
    expect(slides.map(slide => [slide.kind, slide.readOnly])).toEqual([
      ['card', false],
      ['verse', true],
    ]);
    expect(slides[1]?.tile).toBe(verse);
    expect(
      bibleEditorSlides(
        card,
        slides.map(slide => slide.tile),
      ),
    ).toHaveLength(2);
    expect(
      bibleEditorSlides(
        undefined,
        slides.map(slide => slide.tile),
      ),
    ).toEqual([{tile: verse, kind: 'verse', readOnly: true}]);
    expect(bibleEditorSlides(card, [])).toHaveLength(1);
  });
});
