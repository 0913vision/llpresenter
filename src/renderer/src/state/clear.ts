import type {ClearTarget} from '@shared/commands';
import {hasSomethingToClear} from '@renderer/show/clear';
import {sendLive, useLive} from './live';

/** Whether a layer, or any layer for 모두, has something to clear now. */
export function useSomethingToClear(target: ClearTarget): boolean {
  return useLive(view =>
    view.state ? hasSomethingToClear(view.state.layers, target) : false,
  );
}

/** Clears a layer. A layer with nothing to clear does nothing. */
export function clearLayer(target: ClearTarget): void {
  const state = useLive.getState().state;
  if (!state || !hasSomethingToClear(state.layers, target)) return;
  sendLive({type: 'layer.clear', target});
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
