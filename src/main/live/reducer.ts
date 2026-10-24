import type {LiveCommand} from '@shared/commands';
import {
  emptyLayers,
  hasAnyLayer,
  type LayerKind,
  type LiveLayers,
  type LiveState,
  type MediaChoice,
} from '@shared/live';

export interface LiveHistory {
  readonly state: LiveState;
  /**
   * The layers right before the last clear, while that clear can still be
   * undone. Undo has one level, and new content ends it, so an undo never
   * covers something new (docs/spec/03-output.md, undo).
   */
  readonly undo: LiveLayers | null;
}

export function initialHistory(state: LiveState): LiveHistory {
  return {state, undo: null};
}

function withLayers(
  history: LiveHistory,
  layers: LiveLayers,
  undo: LiveLayers | null,
): LiveHistory {
  const version = history.state.version + 1;
  const canUndo = undo !== null;
  return {state: {...history.state, version, layers, canUndo}, undo};
}

function setLayer<K extends LayerKind>(
  history: LiveHistory,
  kind: K,
  value: LiveLayers[K],
): LiveHistory {
  if (history.state.layers[kind] === value) return history;
  const layers = {...history.state.layers, [kind]: value};
  return withLayers(history, layers, null);
}

function showMedia(
  history: LiveHistory,
  choice: MediaChoice,
  now: number,
): LiveHistory {
  const current = history.state.layers.media;
  if (current?.mediaId !== choice.mediaId) {
    return setLayer(history, 'media', {...choice, startedAt: now});
  }
  // NOTE(0913vision): The same background shown again keeps playing from
  // where it is, so it keeps its start time (docs/spec/03-output.md).
  if (current.loop === choice.loop) return history;
  return setLayer(history, 'media', {...current, loop: choice.loop});
}

function clear(history: LiveHistory, target: LayerKind | 'all'): LiveHistory {
  const layers = history.state.layers;
  if (target === 'all') {
    if (!hasAnyLayer(layers)) return history;
    return withLayers(history, emptyLayers(), layers);
  }
  if (layers[target] === null) return history;
  return withLayers(history, {...layers, [target]: null}, layers);
}

function undoClear(history: LiveHistory): LiveHistory {
  if (history.undo === null) return history;
  return withLayers(history, history.undo, null);
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
 * @param now - The time of the command in milliseconds since the epoch, for
 * the start time of a new background.
 * @returns The same history object when nothing changed, so callers can skip
 * the broadcast.
 */
export function applyCommand(
  history: LiveHistory,
  command: LiveCommand,
  now: number,
): LiveHistory {
  switch (command.type) {
    case 'slide.show':
      return setLayer(history, 'slide', command.slide);
    case 'media.show':
      return showMedia(history, command.media, now);
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
