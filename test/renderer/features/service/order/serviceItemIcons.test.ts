import {describe, expect, it} from 'vitest';
import {createMediaId, createSlideId} from '@core/schema/ids';
import {newSectionCard} from '@core/services/sectionCards';
import {newSlidesItem} from '@core/services/slidesEdits';
import {fixtureItems} from '@fixtures/renderer/features/service/items/itemFixture';
import {
  serviceRowIcon,
  slidesItemIcon,
} from '@renderer/features/service/order/serviceItemIcons';

const image = createMediaId('00000000-0000-4000-8000-000000000001');
const slideId = createSlideId('00000000-0000-4000-8000-000000000002');
const picture = {
  label: null,
  labelColor: 'none' as const,
  lines: [],
  picture: image,
};
const text = {label: null, labelColor: 'none' as const, lines: ['text']};
const row = {
  id: 'slides',
  kind: 'slides' as const,
  form: 'blank' as const,
  title: 'Slides',
};

describe('service item icons', () => {
  it('uses the image icon only for nonempty all-picture decks, ignoring the opening section card', () => {
    expect(serviceRowIcon(row, [picture])).toBe('image');
    expect(
      serviceRowIcon(row, [{...text, sectionCard: newSectionCard()}, picture]),
    ).toBe('image');
    expect(serviceRowIcon(row, [picture, text])).toBe('monitor');
    expect(serviceRowIcon(row, [])).toBe('monitor');
    expect(
      serviceRowIcon({kind: 'song', id: 'song', title: 'Song'}, [picture]),
    ).toBe('song');
  });

  it('uses the same classification for service picker source items', () => {
    const base = newSlidesItem('blank', fixtureItems.plain);
    const item = {
      ...base,
      slides: {...base.slides, slides: [{id: slideId, media: image}]},
    };
    expect(slidesItemIcon(item)).toBe('image');
    expect(
      slidesItemIcon({
        ...item,
        slides: {
          ...item.slides,
          slides: [...item.slides.slides, {id: slideId, text: 'text'}],
        },
      }),
    ).toBe('monitor');
    expect(
      slidesItemIcon({...item, slides: {...item.slides, slides: []}}),
    ).toBe('monitor');
  });
});
