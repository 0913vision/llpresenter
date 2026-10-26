import {
  layerKinds,
  type LayerKind,
  type LiveLayers,
  type LiveState,
} from '@shared/live';
import type {ClearTarget} from '@shared/commands';
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
  readonly clearSnapshots?: Readonly<Partial<Record<ClearTarget, UndoEntry>>>;
}

export function initialHistory(state: LiveState): LiveHistory {
  return {
    state: state.clearToggles?.length ? {...state, clearToggles: []} : state,
    undo: null,
  };
}

/** The history with new layers, the next version, and the given undo entry. */
export function withLayers(
  history: LiveHistory,
  layers: LiveLayers,
  undo: UndoEntry | null,
): LiveHistory {
  const version = history.state.version + 1;
  const canUndo = undo !== null;
  return {
    ...history,
    state: {...history.state, version, layers, canUndo},
    undo,
  };
}

/** Attaches at most one captured clear per key and publishes its restore state. */
export function withClearSnapshots(
  history: LiveHistory,
  clearSnapshots: NonNullable<LiveHistory['clearSnapshots']>,
): LiveHistory {
  const targets: readonly ClearTarget[] = ['all', ...layerKinds];
  return {
    ...history,
    clearSnapshots,
    state: {
      ...history.state,
      clearToggles: targets.filter(
        target => clearSnapshots[target] !== undefined,
      ),
    },
  };
}

/** New output content invalidates every clear key's captured picture. */
export function resetClearToggles(history: LiveHistory): LiveHistory {
  return history.state.clearToggles?.length
    ? withClearSnapshots(history, {})
    : history;
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
  const changed = updateLayer(history, kind, value);
  return changed === history || value === null
    ? changed
    : resetClearToggles(changed);
}

/** Updates transport or retained content without invalidating clear captures. */
export function updateLayer<K extends LayerKind>(
  history: LiveHistory,
  kind: K,
  value: LiveLayers[K],
): LiveHistory {
  if (history.state.layers[kind] === value) return history;
  const layers = {...history.state.layers, [kind]: value};
  return withLayers(history, layers, null);
}
