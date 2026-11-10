import {expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {newSlidesItem} from '@core/services/slidesEdits';
import {newSectionCard} from '@core/services/sectionCards';
import {contentPosition} from '@renderer/app/prepCardPosition';
import {
  itemFixture,
  fixtureItems,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {isItemOfKind} from '@core/schema/service';

it('translates visible card and content positions for the slides editor', () => {
  const item = newSlidesItem(
    'blank',
    createServiceItemId('55000000-0000-4000-8000-000000000001'),
  );
  expect(contentPosition(item, 1)).toBe(1);
  const withCard = {...item, sectionCard: newSectionCard()};
  expect(contentPosition(withCard, 0)).toBe(0);
  expect(contentPosition(withCard, 1)).toBe(0);
  expect(contentPosition(withCard, 2)).toBe(1);
});

it('translates the same positions when opening a service song', () => {
  const item = itemFixture()
    .service()
    .service.order.find(row => row.id === fixtureItems.arranged);
  if (item === undefined || !isItemOfKind(item, 'song')) {
    throw Error('missing song');
  }
  const withCard = {...item, sectionCard: newSectionCard()};
  expect(contentPosition(withCard, 0)).toBe(0);
  expect(contentPosition(withCard, 1)).toBe(0);
  expect(contentPosition(withCard, 2)).toBe(1);
  expect(contentPosition(item, 2)).toBe(2);
});
