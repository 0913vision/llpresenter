import {expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createServiceId} from '@core/schema/ids';
import {ids, pastDocument} from '@fixtures/core/serviceList';
import {duplicateService} from '@renderer/features/service/list/serviceEdits';

const created = createServiceId('00000000-0000-4000-8000-0000000000c1');

function setup(fill: 'refused' | 'applied') {
  const edit = vi.fn(async (change: ContentEdit): Promise<EditResult> => {
    if (change.type === 'service.create') {
      return {ok: true, value: {id: created, revision: 1}};
    }
    if (change.type === 'service.update' && fill === 'refused') {
      return {
        ok: false,
        error: {reason: 'invalid', message: 'The service is invalid'},
      };
    }
    if (change.type === 'service.update') {
      return {ok: true, value: {id: change.service.id, revision: 2}};
    }
    if (change.type === 'service.delete') {
      return {ok: true, value: {id: change.serviceId, revision: null}};
    }
    throw new Error('Unexpected service edit');
  });
  const api = mockLlpApi({
    services: {
      list: async () => [],
      get: async id => ({
        ...pastDocument,
        service: {...pastDocument.service, id: createServiceId(id)},
        revision: 1,
      }),
    },
    content: {edit},
  });
  return {api, edit};
}

it('deletes the empty new service again when filling the copy is refused', async () => {
  const {api, edit} = setup('refused');
  expect(await duplicateService(api, ids.past)).toBe(false);
  expect(edit.mock.calls.map(call => call[0].type)).toEqual([
    'service.create',
    'service.update',
    'service.delete',
  ]);
  expect(edit.mock.calls[2]?.[0]).toEqual({
    type: 'service.delete',
    serviceId: created,
  });
});

it('keeps the copy when it was filled', async () => {
  const {api, edit} = setup('applied');
  expect(await duplicateService(api, ids.past)).toBe(true);
  expect(edit.mock.calls.map(call => call[0].type)).toEqual([
    'service.create',
    'service.update',
  ]);
});
