import type {ClearTarget} from '@core/live/commands';
import {hasSomethingToClear} from '@renderer/show/clear';
import {sendLive, useLive} from './live';

/** Whether a layer, or any layer for 모두, has something to clear now. */
export function useSomethingToClear(target: ClearTarget): boolean {
  return useLive(view =>
    view.state
      ? hasSomethingToClear(view.state.layers, target) ||
        (view.state.clearToggles?.includes(target) ?? false)
      : false,
  );
}

/** Whether pressing this clear key again restores its captured content. */
export function useClearRestores(target: ClearTarget): boolean {
  return useLive(view => view.state?.clearToggles?.includes(target) ?? false);
}

/** Toggles a key's clear, doing nothing only when it has no content or capture. */
export function clearLayer(target: ClearTarget): void {
  const state = useLive.getState().state;
  if (
    !state ||
    (!hasSomethingToClear(state.layers, target) &&
      !state.clearToggles?.includes(target))
  ) {
    return;
  }
  sendLive({type: 'layer.clear.toggle', target});
}

/** Whether the live state has a clear that 되돌림 can undo. */
export function useCanUndo(): boolean {
  return useLive(view => view.state?.canUndo ?? false);
}

/** Undoes the last clear. With nothing to undo it does nothing. */
export function undoClear(): void {
  if (!useLive.getState().state?.canUndo) return;
  sendLive({type: 'clear.undo'});
}
