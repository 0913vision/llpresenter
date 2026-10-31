import {expect, it, vi} from 'vitest';
import type {ServiceItem} from '@core/schema/service';
import {
  parseServiceDocument,
  parseServiceEntries,
} from '@core/schema/contentDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {countServiceItemUses} from './serviceItemUsage';

const macro = '00000000-0000-4000-8000-000000000001';
const matches = (item: ServiceItem) => 'macro' in item && item.macro === macro;
const serviceId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
function entries(count: number) {
  const parsedEntries = parseServiceEntries(
    Array.from({length: count}, (_, i) => ({
      id: serviceId(i + 10),
      name: '예배',
      date: '2026-11-01T11:00',
      access: 'editable',
    })),
  );
  if (!parsedEntries.ok) throw new Error('Invalid entries');
  return parsedEntries.value;
}
function document(service: string, uses: number) {
  const parsedDocument = parseServiceDocument({
    revision: 1,
    access: 'editable',
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: service,
      name: '예배',
      date: '2026-11-01T11:00',
      order: Array.from({length: uses}, (_, i) => ({
        id: serviceId(i + 100),
        song: serviceId(i + 200),
        macro,
      })),
    },
  });
  if (!parsedDocument.ok || !parsedDocument.value) {
    throw new Error('Invalid service');
  }
  return parsedDocument.value;
}

it('counts matching items across services and ignores deleted services', async () => {
  const list = entries(3);
  const get = vi
    .fn()
    .mockResolvedValueOnce(document(serviceId(10), 2))
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(document(serviceId(12), 1));
  const api = mockLlpApi({services: {list: async () => list, get}});
  await expect(countServiceItemUses(api, matches)).resolves.toBe(3);
});

it('limits simultaneous reads and stops starting batches after cancellation', async () => {
  const list = entries(20);
  let finish: (value: ReturnType<typeof document> | null) => void = () =>
    undefined;
  const pending = new Promise<ReturnType<typeof document> | null>(resolve => {
    finish = resolve;
  });
  const get = vi.fn().mockReturnValue(pending);
  const api = mockLlpApi({services: {list: async () => list, get}});
  const controller = new AbortController();
  const count = countServiceItemUses(api, matches, controller.signal);
  await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(8));
  controller.abort();
  finish(null);
  await expect(count).rejects.toThrow();
  expect(get).toHaveBeenCalledTimes(8);
});

it('reports a read failure rather than claiming there are no uses', async () => {
  const get = vi.fn().mockRejectedValue(new Error('Read failed'));
  const api = mockLlpApi({services: {list: async () => entries(1), get}});
  await expect(countServiceItemUses(api, matches)).rejects.toThrow(
    'Read failed',
  );
});
