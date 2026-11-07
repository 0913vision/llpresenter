import {describe, expect, it, vi} from 'vitest';
import {
  parseServiceDocument,
  type ServiceDocument,
} from '@core/schema/contentDocuments';
import {isRecord} from '@core/common/guards';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
  createSongSlideId,
  createMediaId,
  createThemeId,
} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  ServiceItemClipboard,
  serviceItemClipboardFor,
} from '@renderer/session/serviceItemClipboard';

const serviceId = createServiceId('10000000-0000-4000-8000-000000000001');
const first = createServiceItemId('20000000-0000-4000-8000-000000000001');
const second = createServiceItemId('20000000-0000-4000-8000-000000000002');
const third = createServiceItemId('20000000-0000-4000-8000-000000000003');
const songId = createSongId('30000000-0000-4000-8000-000000000001');
const slides = [
  {
    id: createSongSlideId('60000000-0000-4000-8000-000000000001'),
    lines: ['Original song slide'],
    label: 'Verse',
  },
];

function document(order: readonly unknown[]): ServiceDocument {
  const parsed = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-11-08T09:00',
      order,
    },
    revision: 1,
    access: 'editable',
  });
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid clipboard fixture');
  }
  return parsed.value;
}

function metadata(item: unknown): unknown {
  if (!isRecord(item)) throw new Error('Missing clipboard item');
  return item.future;
}

function setup(
  order: readonly unknown[] = [
    {id: first, song: songId, slides, memo: 'First'},
    {id: second, header: 'Second'},
    {id: third, futureKind: {slides: [{id: 'nested', lines: ['Third']}]}},
  ],
) {
  const state: {document: ServiceDocument | null} = {document: document(order)};
  const get = vi.fn(() => Promise.resolve(state.document));
  const log = vi.fn();
  const api = mockLlpApi({services: {get}, log: {write: log}});
  return {state, get, log, api, clipboard: new ServiceItemClipboard(api)};
}

describe('service item clipboard', () => {
  it('snapshots selected rows in service order and gives every paste independent complete items', async () => {
    const nested = {
      slides: [{id: 'nested', lines: ['Original']}],
      links: ['nested'],
    };
    const {clipboard, state} = setup([
      {
        id: first,
        song: songId,
        slides,
        memo: 'Memo',
        macro: 'macro',
        background: createMediaId('40000000-0000-4000-8000-000000000001'),
        theme: createThemeId('50000000-0000-4000-8000-000000000001'),
        future: nested,
      },
      {id: second, header: 'Not selected'},
      {id: third, futureKind: {value: 3}},
    ]);
    expect(await clipboard.copy(serviceId, new Set([third, first]))).toEqual({
      ok: true,
      value: true,
    });
    nested.slides[0]?.lines.push('Changed after copy');
    state.document = null;
    const pasted = clipboard.createItems();
    expect(pasted).toMatchObject([
      {
        song: songId,
        slides,
        memo: 'Memo',
        macro: 'macro',
        background: '40000000-0000-4000-8000-000000000001',
        theme: '50000000-0000-4000-8000-000000000001',
        future: {
          slides: [{id: 'nested', lines: ['Original']}],
          links: ['nested'],
        },
      },
      {futureKind: {value: 3}},
    ]);
    expect(pasted.map(item => item.id)).not.toContain(first);
    expect(new Set(pasted.map(item => item.id)).size).toBe(2);
    const repeated = clipboard.createItems();
    expect(repeated[0]?.id).not.toBe(pasted[0]?.id);
    expect(metadata(repeated[0])).not.toBe(metadata(pasted[0]));
    expect(metadata(repeated[0])).toEqual(metadata(pasted[0]));
  });

  it('allows copying a read-only source and keeps only the latest overlapping copy request', async () => {
    const {clipboard, get} = setup();
    let finish: ((value: ServiceDocument) => void) | undefined;
    get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const older = clipboard.copy(serviceId, new Set([first]));
    await clipboard.copy(serviceId, new Set([third]));
    finish?.({
      ...document([{id: first, song: songId, slides}]),
      access: 'readOnly',
    });
    await older;
    expect(clipboard.createItems()).toMatchObject([
      {futureKind: {slides: [{lines: ['Third']}]}},
    ]);
    get.mockResolvedValueOnce({
      ...document([{id: first, song: songId, slides}]),
      access: 'readOnly',
    });
    expect(await clipboard.copy(serviceId, new Set([first]))).toEqual({
      ok: true,
      value: true,
    });
  });

  it('keeps the old clipboard when the source is gone, incomplete, empty, oversized or unreadable', async () => {
    const {clipboard, state, get, log} = setup();
    await clipboard.copy(serviceId, new Set([first]));
    expect(await clipboard.copy(serviceId, new Set())).toEqual({
      ok: false,
      error: 'empty',
    });
    expect(await clipboard.copy(serviceId, new Set([first, 'gone']))).toEqual({
      ok: false,
      error: 'missing',
    });
    state.document = document([
      {id: first, futureKind: 'x'.repeat(16 * 1024 * 1024)},
    ]);
    expect(await clipboard.copy(serviceId, new Set([first]))).toEqual({
      ok: false,
      error: 'full',
    });
    state.document = null;
    expect(await clipboard.copy(serviceId, new Set([first]))).toEqual({
      ok: false,
      error: 'missing',
    });
    get.mockRejectedValueOnce(new Error('Read failed'));
    expect(await clipboard.copy(serviceId, new Set([first]))).toEqual({
      ok: false,
      error: 'failed',
    });
    expect(log).toHaveBeenCalledOnce();
    expect(clipboard.createItems()).toMatchObject([
      {song: songId, memo: 'First'},
    ]);
  });

  it('shares one clipboard per API and releases subscribers', async () => {
    const {api} = setup();
    const clipboard = serviceItemClipboardFor(api);
    expect(serviceItemClipboardFor(api)).toBe(clipboard);
    const changed = vi.fn();
    const stop = clipboard.subscribe(changed);
    await clipboard.copy(serviceId, new Set([first]));
    expect(clipboard.getCount()).toBe(1);
    expect(changed).toHaveBeenCalledOnce();
    stop();
    await clipboard.copy(serviceId, new Set([first, second]));
    expect(changed).toHaveBeenCalledOnce();
    expect(serviceItemClipboardFor(setup().api).getCount()).toBe(0);
  });
});
