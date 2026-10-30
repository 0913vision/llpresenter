import type {LlpApi} from '@contracts/ipc/api';
import type {MacroId} from '@core/schema/ids';
import {withinLookupTimeout} from '@renderer/features/presentation/state/showOutput';

const READ_BATCH = 8;

export async function countMacroUses(
  api: LlpApi,
  id: MacroId,
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
      total += document.service.order.filter(
        item => 'macro' in item && item.macro === id,
      ).length;
    }
  }
  return total;
}
