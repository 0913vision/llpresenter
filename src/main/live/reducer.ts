import type {LiveCommand} from '@shared/commands';
import {
  emptyLayers,
  hasAnyLayer,
  type LayerKind,
  type LiveLayers,
  type LiveState,
  type MediaChoice,
  type MediaLayer,
} from '@shared/live';

/** What the last clear took down, and when, so it can be undone. */
export interface UndoEntry {
  readonly layers: LiveLayers;
  readonly clearedAt: number;
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

function withLayers(
  history: LiveHistory,
  layers: LiveLayers,
  undo: UndoEntry | null,
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

function clear(
  history: LiveHistory,
  target: LayerKind | 'all',
  now: number,
): LiveHistory {
  const layers = history.state.layers;
  const undo = {layers, clearedAt: now};
  if (target === 'all') {
    if (!hasAnyLayer(layers)) return history;
    return withLayers(history, emptyLayers(), undo);
  }
  if (layers[target] === null) return history;
  return withLayers(history, {...layers, [target]: null}, undo);
}

function resumedMedia(
  media: MediaLayer | null,
  clearedForMs: number,
): MediaLayer | null {
  if (media === null) return media;
  return {...media, startedAt: media.startedAt + clearedForMs};
}

function undoClear(history: LiveHistory, now: number): LiveHistory {
  const {undo} = history;
  if (undo === null) return history;
  // NOTE(0913vision): A background that the clear took down plays again from
  // where it was cleared, so its start time moves by the time it was down
  // (docs/spec/03-output.md, undo).
  const mediaWasCleared =
    history.state.layers.media === null && undo.layers.media !== null;
  const media = mediaWasCleared
    ? resumedMedia(undo.layers.media, now - undo.clearedAt)
    : undo.layers.media;
  return withLayers(history, {...undo.layers, media}, null);
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
 * the start time of a background and the time of a clear.
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
      return clear(history, command.target, now);
    case 'clear.undo':
      return undoClear(history, now);
    case 'output.set':
      return setOutput(history, command.screenId, command.on);
    default: {
      const unhandled: never = command;
      return unhandled;
    }
  }
}
