import {expect, it} from 'vitest';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {isItemOfKind} from '@core/schema/service';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {
  fixtureItems,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {bibleEditorData} from '@renderer/features/service/items/bibleItemModel';

it('keeps the Bible reference and exposes measured verse slides as read-only', () => {
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('missing section');
  const fixture = itemFixture();
  const document = fixture.service();
  const parsed = parseServiceDocument({
    ...document,
    service: {
      ...document.service,
      order: [
        {
          id: fixtureItems.arranged,
          sectionCard: sectionCardOf(section),
          bible: {
            translation: 'sample',
            ref: 'John 3:16-17',
            split: 'verse',
            reference: 'every',
            verseNumbers: true,
            translationName: false,
          },
        },
      ],
    },
  });
  if (!parsed.ok || parsed.value === null) throw Error('invalid service');
  const item = parsed.value.service.order[0];
  if (item === undefined || !isItemOfKind(item, 'bible')) {
    throw Error('missing Bible');
  }
  const saved = [
    {label: '3:16', labelColor: 'none' as const, lines: ['Original']},
  ];
  const measured = [
    {label: '3:16', labelColor: 'none' as const, lines: ['Part one']},
    {label: '3:16', labelColor: 'none' as const, lines: ['Part two']},
  ];
  const data = bibleEditorData(item, saved, measured);
  expect(data.reference).toBe(item.bible);
  expect(
    data.slides.map(slide => [slide.kind, slide.readOnly, slide.tile.lines]),
  ).toEqual([
    ['card', false, [section.english]],
    ['verse', true, ['Part one']],
    ['verse', true, ['Part two']],
  ]);
  expect(bibleEditorData(item, saved).slides[1]?.tile).toBe(saved[0]);
  expect(bibleEditorData(item, saved, []).slides).toHaveLength(1);
  const withoutCard = {...item};
  delete withoutCard.sectionCard;
  expect(bibleEditorData(withoutCard, saved).slides).toEqual([
    {tile: saved[0], kind: 'verse', readOnly: true},
  ]);
});
