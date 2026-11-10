import {describe, expect, it} from 'vitest';
import {createMediaId, createServiceItemId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {sectionItemCount} from '@renderer/features/service/details/detailsHeading';

const first = createServiceItemId('00000000-0000-4000-8000-000000000101');
const second = createServiceItemId('00000000-0000-4000-8000-000000000102');
const itemId = createServiceItemId('00000000-0000-4000-8000-000000000103');
const missing = createServiceItemId('00000000-0000-4000-8000-000000000104');
const header = (id: typeof first): ServiceItem => ({id, header: 'Section'});
const item: ServiceItem = {
  id: itemId,
  media: createMediaId('00000000-0000-4000-8000-000000000105'),
};

describe('sectionItemCount', () => {
  it('counts only items before the next header', () => {
    expect(
      sectionItemCount([header(first), item, header(second), item], first),
    ).toBe(1);
  });
  it('returns zero for a header at the end', () => {
    expect(sectionItemCount([item, header(first)], first)).toBe(0);
  });
  it('returns zero for consecutive headers', () => {
    expect(sectionItemCount([header(first), header(second), item], first)).toBe(
      0,
    );
  });
  it('returns zero for a missing id or a non-header id', () => {
    expect(sectionItemCount([header(first), item], missing)).toBe(0);
    expect(sectionItemCount([header(first), item], itemId)).toBe(0);
  });
});
