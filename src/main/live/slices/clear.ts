import type {ClearTarget} from '@shared/commands';
import {emptyLayers, hasAnyLayer, type MediaLayer} from '@shared/live';
import {withLayers, type LiveHistory} from '../history';
import {defineSlice} from '../slice';

function clear(
  history: LiveHistory,
  target: ClearTarget,
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

/** Clears layers and undoes the last clear, one level deep. */
export const clearSlice = defineSlice({
  commands: ['layer.clear', 'clear.undo'],
  initial: {canUndo: false},
  reduce: (history, command, now) => {
    switch (command.type) {
      case 'layer.clear':
        return clear(history, command.target, now);
      case 'clear.undo':
        return undoClear(history, now);
    }
  },
});
