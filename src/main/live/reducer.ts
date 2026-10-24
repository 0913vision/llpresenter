import type {LiveCommand} from '@shared/commands';
import {
  emptyLayers,
  hasAnyLayer,
  type LayerKind,
  type LiveLayers,
  type LiveState,
} from '@shared/live';

/** How many clears can be undone. Older entries are dropped first. */
export const UNDO_LIMIT = 20;

export interface LiveHistory {
  readonly state: LiveState;
  /** The layers right before each clear, most recent last. */
  readonly undo: readonly LiveLayers[];
}

export function initialHistory(state: LiveState): LiveHistory {
  return {state, undo: []};
}

function withLayers(
  history: LiveHistory,
  layers: LiveLayers,
  undo: readonly LiveLayers[],
): LiveHistory {
  const version = history.state.version + 1;
  return {state: {...history.state, version, layers}, undo};
}

function pushUndo(
  undo: readonly LiveLayers[],
  layers: LiveLayers,
): readonly LiveLayers[] {
  const next = [...undo, layers];
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
}

function setLayer<K extends LayerKind>(
  history: LiveHistory,
  kind: K,
  value: LiveLayers[K],
): LiveHistory {
  if (history.state.layers[kind] === value) return history;
  const layers = {...history.state.layers, [kind]: value};
  return withLayers(history, layers, history.undo);
}

function clear(history: LiveHistory, target: LayerKind | 'all'): LiveHistory {
  const layers = history.state.layers;
  if (target === 'all') {
    if (!hasAnyLayer(layers)) return history;
    return withLayers(history, emptyLayers(), pushUndo(history.undo, layers));
  }
  if (layers[target] === null) return history;
  const cleared = {...layers, [target]: null};
  return withLayers(history, cleared, pushUndo(history.undo, layers));
}

function undoClear(history: LiveHistory): LiveHistory {
  const previous = history.undo.at(-1);
  if (previous === undefined) return history;
  return withLayers(history, previous, history.undo.slice(0, -1));
}

function setOutput(
  history: LiveHistory,
  screenId: string,
  on: boolean,
): LiveHistory {
  const state = history.state;
  if ((state.outputs[screenId] ?? false) === on) return history;
  const outputs = {...state.outputs, [screenId]: on};
  return {...history, state: {...state, version: state.version + 1, outputs}};
}

/**
 * Applies one command. This is a pure function, so it is tested without
 * Electron.
 *
 * @returns The same history object when nothing changed, so callers can skip
 * the broadcast.
 */
export function applyCommand(
  history: LiveHistory,
  command: LiveCommand,
): LiveHistory {
  switch (command.type) {
    case 'slide.show':
      return setLayer(history, 'slide', command.slide);
    case 'media.show':
      return setLayer(history, 'media', command.media);
    case 'message.show':
      return setLayer(history, 'message', command.message);
    case 'layer.clear':
      return clear(history, command.target);
    case 'clear.undo':
      return undoClear(history);
    case 'output.set':
      return setOutput(history, command.screenId, command.on);
    default: {
      const unhandled: never = command;
      return unhandled;
    }
  }
}
