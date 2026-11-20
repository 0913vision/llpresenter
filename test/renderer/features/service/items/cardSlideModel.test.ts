import {describe, expect, it} from 'vitest';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {bibleEditorSlides} from '@renderer/features/service/items/cardSlideModel';

const section = SUNDAY_SECTIONS[0];
if (section === undefined) throw Error('missing section');
const card = sectionCardOf(section);
describe('item card slide model', () => {
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
