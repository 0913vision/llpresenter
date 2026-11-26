import type {ClearTarget} from '@core/schema/live/live';
import {hasSomethingToClear} from '@core/live';
import {sendLive, useLive} from '../live';

/**
 * Stops the live item while leaving independent overlays and audio running.
 * Main does nothing when no item is live; the window sends every press, so one
 * made before it hears the state still counts.
 */
export function stopItem(): void {
  sendLive({type: 'item.stop'});
}

/**
 * 대기 화면: main takes the active item off or brings back the one it took
 * off, from where it has it, so a press made before this window hears the one
 * before still counts.
 */
export function toggleItem(): void {
  sendLive({type: 'item.toggle'});
}

/** Whether a layer, or any layer for 모두, has something to clear now. */
export function useSomethingToClear(target: ClearTarget): boolean {
  return useLive(view =>
    view.state
      ? (target === 'all' && (view.state.testPatterns?.length ?? 0) > 0) ||
        hasSomethingToClear(view.state.layers, target) ||
        (view.state.clearToggles?.includes(target) ?? false)
      : false,
  );
}

/** Whether pressing this clear key again restores its captured content. */
export function useClearRestores(target: ClearTarget): boolean {
  return useLive(view => view.state?.clearToggles?.includes(target) ?? false);
}

/**
 * Toggles a key's clear. Main clears what it has, brings back what the key
 * cleared, and does nothing when there is neither.
 */
export function clearLayer(target: ClearTarget): void {
  sendLive({type: 'layer.clear.toggle', target});
}

/** Whether the live state has a clear that 되돌리기 can undo. */
export function useCanUndo(): boolean {
  return useLive(view => view.state?.canUndo ?? false);
}

/** Undoes the last clear; main does nothing when there is nothing to undo. */
export function undoClear(): void {
  sendLive({type: 'clear.undo'});
}
