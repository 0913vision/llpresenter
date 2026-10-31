import type {LlpApi} from '@contracts/ipc/api';
import type {MacroId} from '@core/schema/ids';
import {countServiceItemUses} from '@renderer/features/service/serviceItemUsage';

export function countMacroUses(
  api: LlpApi,
  id: MacroId,
  signal?: AbortSignal,
): Promise<number> {
  return countServiceItemUses(
    api,
    item => 'macro' in item && item.macro === id,
    signal,
  );
}
