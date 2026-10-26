import {describe, expect, it, vi} from 'vitest';
import {
  parseServiceDocument,
  type ServiceDocument,
} from '@shared/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';
import {createServiceId, createServiceItemId} from '@shared/schema/ids';
import {isItemOfKind} from '@shared/schema/service';
import {updateServiceItem} from './serviceItemUpdate';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000011');
const headerId = createServiceItemId('10000000-0000-4000-8000-000000000011');
const slotId = createServiceItemId('10000000-0000-4000-8000-000000000012');

function setup() {
  const parsed = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-10-26T09:00',
      order: [
        {id: headerId, header: 'Invented header', future: 1},
        {id: slotId, slot: 'bible', title: 'Invented slot'},
      ],
    },
    revision: 2,
    access: 'editable',
  });
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid service fixture');
  }
  const document = parsed.value;
  const edit = vi
    .fn<(edit: ContentEdit) => Promise<EditResult>>()
    .mockResolvedValue({ok: true, value: {id: serviceId, revision: 3}});
  const api = {
    services: {
      get: vi.fn(() => Promise.resolve<ServiceDocument | null>(document)),
      list: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      subscribeList: () => () => undefined,
    },
    content: {edit},
  };
  return {document, api, edit};
}

describe('one service item update', () => {
  it('replaces only the named item, in place, with its unknown fields', async () => {
    const {document, api, edit} = setup();
    const result = await updateServiceItem(api, {
      serviceId,
      itemId: headerId,
      change: item =>
        isItemOfKind(item, 'header') ? {...item, header: 'Renamed'} : null,
    });
    expect(result).toEqual({ok: true, value: {id: serviceId, revision: 3}});
    expect(edit).toHaveBeenCalledWith({
      type: 'service.update',
      baseRevision: 2,
      service: {
        ...document.service,
        order: [
          {id: headerId, header: 'Renamed', future: 1},
          document.service.order[1],
        ],
      },
    });
  });

  it('answers the current revision without an edit when nothing changes', async () => {
    const {api, edit} = setup();
    expect(
      await updateServiceItem(api, {
        serviceId,
        itemId: slotId,
        change: item => item,
      }),
    ).toEqual({ok: true, value: {id: serviceId, revision: 2}});
    expect(edit).not.toHaveBeenCalled();
  });

  it('refuses an item that is gone or that refuses the change', async () => {
    const {api, edit} = setup();
    for (const itemId of [
      createServiceItemId('10000000-0000-4000-8000-000000000099'),
      slotId,
    ]) {
      expect(
        await updateServiceItem(api, {serviceId, itemId, change: () => null}),
      ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    }
    expect(edit).not.toHaveBeenCalled();
  });
});
