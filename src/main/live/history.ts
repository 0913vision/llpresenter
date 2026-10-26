import type {LayerKind, LiveLayers, LiveState} from '@shared/live';
import type {MessageId} from '@shared/schema/ids';

/** What the last clear took down, and when, so it can be undone. */
export interface UndoEntry {
  readonly layers: LiveLayers;
  readonly clearedAt: number;
  readonly audioClearedAt?: number;
  readonly clearedMessageIds?: readonly MessageId[];
  readonly stageMessage?: string;
}

export interface LiveHistory {
  readonly state: LiveState;
  /**
   * The last clear, while it can still be undone. Undo has one level, and new
   * content ends it, so an undo never covers something new
   * (docs/spec/03-output.md, undo).
   */
  readonly undo: UndoEntry | null;
}

export function initialHistory(state: LiveState): LiveHistory {
  return {state, undo: null};
}

/** The history with new layers, the next version, and the given undo entry. */
export function withLayers(
  history: LiveHistory,
  layers: LiveLayers,
  undo: UndoEntry | null,
): LiveHistory {
  const version = history.state.version + 1;
  const canUndo = undo !== null;
  return {state: {...history.state, version, layers, canUndo}, undo};
}

/**
 * Puts new content on one layer, which ends the undo. The same value again
 * returns the same history, so callers can skip the broadcast.
 */
export function setLayer<K extends LayerKind>(
  history: LiveHistory,
  kind: K,
  value: LiveLayers[K],
): LiveHistory {
  if (history.state.layers[kind] === value) return history;
  const layers = {...history.state.layers, [kind]: value};
  return withLayers(history, layers, null);
}
