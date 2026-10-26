import type {ClearTarget} from '@shared/commands';
import {
  emptyLayers,
  hasAnyLayer,
  type MediaLayer,
  type MessageLayer,
  type NoticeLayer,
  type AudioLayer,
} from '@shared/live';
import {audioPositionSeconds} from '@shared/schema/audioState';
import {withLayers, type LiveHistory} from '../history';
import {defineSlice, type SliceContext} from '../slice';

function clear(
  history: LiveHistory,
  target: ClearTarget,
  {now, timerNow = now}: SliceContext,
): LiveHistory {
  const layers = history.state.layers;
  const undo = {
    layers,
    clearedAt: now,
    ...(layers.audio?.playback !== undefined &&
    (target === 'all' || target === 'audio')
      ? {audioClearedAt: timerNow}
      : {}),
  };
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

function undoClear(
  history: LiveHistory,
  {now, timerNow = now}: SliceContext,
): LiveHistory {
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
  const elapsed = Math.max(0, now - undo.clearedAt);
  const message =
    history.state.layers.message === null
      ? resumedMessages(undo.layers.message, elapsed)
      : undo.layers.message;
  const notice =
    history.state.layers.notice === null
      ? resumedNotice(undo.layers.notice, elapsed)
      : undo.layers.notice;
  const audio =
    history.state.layers.audio === null && undo.audioClearedAt !== undefined
      ? resumedAudio(undo.layers.audio, {
          now: timerNow,
          clearedAt: undo.audioClearedAt,
          version: history.state.version + 1,
        })
      : undo.layers.audio;
  return withLayers(
    history,
    {...undo.layers, media, message, notice, audio},
    null,
  );
}

function resumedAudio(
  audio: AudioLayer | null,
  clock: {now: number; clearedAt: number; version: number},
): AudioLayer | null {
  const playback = audio?.playback;
  if (audio === null || playback === undefined) return audio;
  return {
    ...audio,
    playback: {
      ...playback,
      positionSeconds: audioPositionSeconds(playback, clock.clearedAt),
      since: playback.since === null ? null : clock.now,
      trackVersion: clock.version,
    },
  };
}

function resumedMessages(
  layer: MessageLayer | null,
  elapsed: number,
): MessageLayer | null {
  if (layer?.items === undefined) return layer;
  return {
    ...layer,
    items: layer.items.map(item => ({
      ...item,
      startedAt: item.startedAt + elapsed,
      expiresAt: item.expiresAt === null ? null : item.expiresAt + elapsed,
    })),
  };
}

function resumedNotice(
  layer: NoticeLayer | null,
  elapsed: number,
): NoticeLayer | null {
  if (layer?.playback === undefined) return layer;
  return {
    ...layer,
    playback: {
      ...layer.playback,
      startedAt: layer.playback.startedAt + elapsed,
      pausedAt:
        layer.playback.pausedAt === null
          ? null
          : layer.playback.pausedAt + elapsed,
    },
  };
}

/** Clears layers and undoes the last clear, one level deep. */
export const clearSlice = defineSlice({
  commands: ['layer.clear', 'clear.undo'],
  initial: {canUndo: false},
  reduce: (history, command, context) => {
    switch (command.type) {
      case 'layer.clear':
        return clear(history, command.target, context);
      case 'clear.undo':
        return undoClear(history, context);
    }
  },
});
