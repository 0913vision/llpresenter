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

// TODO(0913vision): Ask for undo only while the live state says there is
// something to undo (`canUndo`), and dim the 되돌림 button otherwise.
export function undoClear(): void {
  sendLive({type: 'clear.undo'});
}
