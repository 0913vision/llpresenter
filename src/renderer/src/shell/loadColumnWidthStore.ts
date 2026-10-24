import type {LlpApi} from '@shared/ipc';
import type {LayoutChange, UiState} from '@shared/schema/uiState';
import {
  createIpcColumnWidthStore,
  createMemoryColumnWidthStore,
  type ColumnWidthStore,
} from './columnWidthStore';

/**
 * Reads the saved UI state once. Outside Electron (no `window.llp`) there is
 * none. When the main process cannot answer, the failure is logged and the
 * state is empty, so everything starts from the defaults.
 */
export async function loadUiState(api: LlpApi | undefined): Promise<UiState> {
  if (api === undefined) return {};
  try {
    return await api.ui.get();
  } catch (error) {
    api.log.write({
      level: 'error',
      message: 'could not read the UI state',
      detail: error instanceof Error ? (error.stack ?? error.message) : '',
    });
    return {};
  }
}

/**
 * The store for the column widths, starting from the saved UI state. Outside
 * Electron, the widths stay in memory.
 */
export function createColumnWidthStore(
  api: LlpApi | undefined,
  uiState: UiState,
): ColumnWidthStore {
  if (api === undefined) return createMemoryColumnWidthStore();
  const send = (change: LayoutChange): void => api.ui.setLayout(change);
  return createIpcColumnWidthStore(uiState, send);
}

/** Reads the saved UI state and returns the store for the column widths. */
export async function loadColumnWidthStore(
  api: LlpApi | undefined,
): Promise<ColumnWidthStore> {
  return createColumnWidthStore(api, await loadUiState(api));
}
