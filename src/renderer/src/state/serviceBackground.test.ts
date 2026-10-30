import {describe, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import {pendingWritesOf} from '../platform/pendingWrites';
import {updateServiceBackground} from './serviceBackground';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const itemId = createServiceItemId('10000000-0000-4000-8000-000000000001');
const songId = createSongId('20000000-0000-4000-8000-000000000001');
const mediaId = createMediaId('30000000-0000-4000-8000-000000000001');
const otherId = createServiceItemId('10000000-0000-4000-8000-000000000002');

function setup() {
  const parsed = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-10-26T09:00',
      future: {keep: true},
      order: [
        {
          id: itemId,
          song: songId,
          arrangement: 'Invented arrangement',
          memo: 'Keep this',
          future: [1, 2],
        },
        {id: otherId, header: 'Invented header'},
      ],
    },
    revision: 7,
    access: 'editable',
  });
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid service fixture');
  }
  const document = parsed.value;
  const get = vi.fn(() => Promise.resolve<ServiceDocument | null>(document));
  const edit = vi
    .fn<(edit: ContentEdit) => Promise<EditResult>>()
    .mockResolvedValue({ok: true, value: {id: serviceId, revision: 8}});
  const api = {
    services: {
      get,
      list: () => Promise.resolve([]),
      subscribe: () => () => undefined,
      subscribeList: () => () => undefined,
    },
    content: {edit},
  };
  const change = {serviceId, itemId, mediaId};
  return {document, api, get, edit, change};
}

describe('service song background edits', () => {
  it('runs through the window pending writes and refuses once they stop for a close', async () => {
    const {api, get, edit, change} = setup();
    let answer: () => void = () => undefined;
    get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = () => {
            resolve(null);
          };
        }),
    );
    const writes = pendingWritesOf(api);
    const changing = updateServiceBackground(api, change);
    const flushing = writes.flush();
    answer();
    expect(await changing).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(await flushing).toBe(false);
    expect(await updateServiceBackground(api, change)).toMatchObject({
      ok: false,
      error: {reason: 'request-failed'},
    });
    expect(edit).not.toHaveBeenCalled();
    writes.resume();
  });

  it('sets only the item override against the fresh revision and preserves unknown data', async () => {
    const {document, api, edit, change} = setup();
    const before = structuredClone(document);
    expect(await updateServiceBackground(api, change)).toEqual({
      ok: true,
      value: {id: serviceId, revision: 8},
    });
    expect(edit).toHaveBeenCalledWith({
      type: 'service.update',
      baseRevision: 7,
      service: {
        ...document.service,
        order: document.service.order.map(row =>
          row.id === itemId ? {...row, background: mediaId} : row,
        ),
      },
    });
    expect(document).toEqual(before);
  });

  it('removes the override for the song default and skips unchanged choices', async () => {
    const {document, api, get, edit, change} = setup();
    await updateServiceBackground(api, {...change, mediaId: null});
    expect(edit).not.toHaveBeenCalled();
    get.mockResolvedValue({
      ...document,
      revision: 9,
      service: {
        ...document.service,
        order: document.service.order.map(row =>
          row.id === itemId ? {...row, background: mediaId} : row,
        ),
      },
    });
    await updateServiceBackground(api, change);
    expect(edit).not.toHaveBeenCalled();
    await updateServiceBackground(api, {...change, mediaId: null});
    expect(edit).toHaveBeenCalledWith({
      type: 'service.update',
      baseRevision: 9,
      service: document.service,
    });
  });

  it('refuses read-only services and does not submit an update', async () => {
    const {document, api, get, edit, change} = setup();
    get.mockResolvedValue({...document, access: 'readOnly'});
    expect(await updateServiceBackground(api, change)).toMatchObject({
      ok: false,
      error: {reason: 'read-only'},
    });
    expect(edit).not.toHaveBeenCalled();
  });

  it('refuses missing services, another service, missing items, and non-song rows', async () => {
    const {document, api, get, edit, change} = setup();
    get.mockResolvedValueOnce(null);
    expect(await updateServiceBackground(api, change)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    get.mockResolvedValueOnce({
      ...document,
      service: {
        ...document.service,
        id: createServiceId('00000000-0000-4000-8000-000000000002'),
      },
    });
    expect(await updateServiceBackground(api, change)).toMatchObject({
      ok: false,
    });
    get.mockResolvedValueOnce({
      ...document,
      service: {...document.service, order: []},
    });
    expect(await updateServiceBackground(api, change)).toMatchObject({
      ok: false,
    });
    expect(
      await updateServiceBackground(api, {...change, itemId: otherId}),
    ).toMatchObject({ok: false});
    expect(edit).not.toHaveBeenCalled();
  });

  it('returns main refusals and applied disk failures without losing their semantics', async () => {
    const {api, edit, change} = setup();
    const stale: EditResult = {
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    };
    edit.mockResolvedValueOnce(stale);
    expect(await updateServiceBackground(api, change)).toEqual(stale);
    const failed: EditResult = {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk full',
        applied: {id: serviceId, revision: 8},
        unchangedFiles: ['invented.llservice'],
      },
    };
    edit.mockResolvedValueOnce(failed);
    expect(await updateServiceBackground(api, change)).toEqual(failed);
  });

  it('retains rejected read and write causes in explicit results', async () => {
    const {api, get, edit, change} = setup();
    get.mockRejectedValueOnce(new Error('Read failed'));
    expect(await updateServiceBackground(api, change)).toEqual({
      ok: false,
      error: {reason: 'request-failed', message: 'Read failed'},
    });
    edit.mockRejectedValueOnce(new Error('Write failed'));
    expect(await updateServiceBackground(api, change)).toEqual({
      ok: false,
      error: {reason: 'request-failed', message: 'Write failed'},
    });
  });
});
