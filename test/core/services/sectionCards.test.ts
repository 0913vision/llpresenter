import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {
  sectionCardSchema,
  SLIDES_LIMITS,
  templateSchema,
  isItemOfKind,
} from '@core/schema/service';
import {sundayTemplate} from '@core/services/sundayTemplate';
import {
  cardOffset,
  sectionCardOf,
  withSectionCard,
} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {nextTile, previousTile} from '@core/presentation/navigation';

const section = SUNDAY_SECTIONS[1];
if (section === undefined) throw new Error('missing section');
const card = sectionCardOf(section);

describe('section card', () => {
  it('accepts bounded fields and rejects invalid values', () => {
    expect(v.safeParse(sectionCardSchema, card).success).toBe(true);
    expect(v.safeParse(sectionCardSchema, {...card, name: '  '}).success).toBe(
      false,
    );
    const future = v.safeParse(sectionCardSchema, {
      ...card,
      future: {kept: true},
    });
    expect(future.success && future.output).toMatchObject({
      future: {kept: true},
    });
    expect(
      v.safeParse(sectionCardSchema, {
        ...card,
        name: 'x'.repeat(SLIDES_LIMITS.name + 1),
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(sectionCardSchema, {
        ...card,
        english: 'x'.repeat(SLIDES_LIMITS.text + 1),
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(sectionCardSchema, {...card, theme: 'invalid'}).success,
    ).toBe(false);
    expect(v.safeParse(sectionCardSchema, {...card, english: 3}).success).toBe(
      false,
    );
  });
  it('prepends one card and navigates through the original sequence', () => {
    const original = [
      {label: 'Verse', labelColor: 'none' as const, lines: ['text']},
    ];
    const tiles = withSectionCard(card, original);
    expect(withSectionCard(undefined, original)).toBe(original);
    expect(withSectionCard(card, original)).toBe(tiles);
    // NOTE(0913vision): A published projection may already contain a card.
    const updated = {...card, english: 'Edited'};
    expect(withSectionCard(updated, tiles)).toEqual([
      {...tiles[0], lines: ['Edited'], sectionCard: updated},
      ...original,
    ]);
    expect(slideLayerOf({itemId: 'item', index: 0}, () => tiles)).toMatchObject(
      {
        sectionCard: card,
        sequenceLength: 2,
        lines: [card.english],
        next: {lines: ['text']},
      },
    );
    const state = {
      tilesOf: () => tiles,
      openItemId: 'item',
      live: {itemId: 'item', index: 0},
    };
    expect(nextTile(state)).toEqual({itemId: 'item', index: 1});
    expect(previousTile({...state, live: {itemId: 'item', index: 1}})).toEqual({
      itemId: 'item',
      index: 0,
    });
  });
});

it('validates the optional card in a service item without changing older data', () => {
  const template = sundayTemplate();
  const item = template.order.find(
    row => isItemOfKind(row, 'slides') && row.sectionCard !== undefined,
  );
  if (
    item === undefined ||
    !isItemOfKind(item, 'slides') ||
    item.sectionCard === undefined
  ) {
    throw Error('missing card');
  }
  const data = {...template, order: [item]};
  expect(v.safeParse(templateSchema, data).success).toBe(true);
  expect(
    v.safeParse(templateSchema, {
      ...data,
      order: [
        {
          ...item,
          sectionCard: {
            ...item.sectionCard,
            name: 'x'.repeat(SLIDES_LIMITS.name + 1),
          },
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    v.safeParse(templateSchema, {
      ...data,
      order: [
        {...item, sectionCard: {...item.sectionCard, theme: 'not-a-theme'}},
      ],
    }).success,
  ).toBe(false);
  const {sectionCard: _card, ...oldItem} = item;
  expect(v.safeParse(templateSchema, {...data, order: [oldItem]}).success).toBe(
    true,
  );
});

it('treats an explicitly undefined card as absent', () => {
  expect(cardOffset({sectionCard: undefined})).toBe(0);
  expect(cardOffset({cardOffset: 1})).toBe(1);
});
