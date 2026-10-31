import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItem} from '@core/schema/service';
import {withinLookupTimeout} from '@renderer/session/showOutput';

const READ_BATCH = 8;

export async function countServiceItemUses(
  api: LlpApi,
  matches: (item: ServiceItem) => boolean,
  signal?: AbortSignal,
): Promise<number> {
  signal?.throwIfAborted();
  const entries = await withinLookupTimeout(() => api.services.list());
  let total = 0;
  for (let start = 0; start < entries.length; start += READ_BATCH) {
    signal?.throwIfAborted();
    const batch = entries.slice(start, start + READ_BATCH);
    const documents = await Promise.all(
      batch.map(entry => withinLookupTimeout(() => api.services.get(entry.id))),
    );
    signal?.throwIfAborted();
    for (const document of documents) {
      if (!document) continue;
      total += document.service.order.filter(matches).length;
    }
  }
  return total;
}
