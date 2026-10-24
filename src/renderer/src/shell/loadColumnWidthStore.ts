import type {LlpApi} from '@shared/ipc';
import type {LayoutChange} from '@shared/schema/uiState';
import {
  createIpcColumnWidthStore,
  createMemoryColumnWidthStore,
  type ColumnWidthStore,
} from './columnWidthStore';

/**
 * Reads the saved UI state once and returns the store for the column widths.
 * Outside Electron (no `window.llp`), the widths stay in memory. When the main
 * process cannot answer, the store starts from the defaults and the failure is
 * logged.
 */
export async function loadColumnWidthStore(
  api: LlpApi | undefined,
): Promise<ColumnWidthStore> {
  if (api === undefined) return createMemoryColumnWidthStore();
  const send = (change: LayoutChange): void => api.ui.setLayout(change);
  try {
    return createIpcColumnWidthStore(await api.ui.get(), send);
  } catch (error) {
    api.log.write({
      level: 'error',
      message: 'could not read the UI state',
      detail: error instanceof Error ? (error.stack ?? error.message) : '',
    });
    return createIpcColumnWidthStore({}, send);
  }
}
