import type {ClearTarget} from '@shared/commands';
import {
  emptyLayers,
  hasAnyLayer,
  type LayerKind,
  type LiveLayers,
  type MediaLayer,
  type MessageLayer,
  type NoticeLayer,
  type AudioLayer,
} from '@shared/live';
import {audioPositionSeconds} from '@shared/schema/audioState';
import type {MessageId} from '@shared/schema/ids';
import {clearOverlay} from '../clearOverlay';
import {withClearEffects} from '../clearEffects';
import {nextAudioTrackVersion} from '../audioTrackVersion';
import {
  withLayers,
  withClearSnapshots,
  resetClearToggles,
  type LiveHistory,
} from '../history';
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

function toggleClear(
  history: LiveHistory,
  target: ClearTarget,
  context: SliceContext,
): LiveHistory {
  const saved = history.clearSnapshots?.[target];
  if (saved === undefined) {
    const cleared = clear(history, target, context);
    if (cleared === history || cleared.undo === null) return history;
    return withClearSnapshots(cleared, {
      ...history.clearSnapshots,
      [target]: cleared.undo,
    });
  }
  const current = history.state.layers;
  const restore = <K extends LayerKind>(kind: K): LiveLayers[K] =>
    (target === 'all' || target === kind) && current[kind] === null
      ? saved.layers[kind]
      : current[kind];
  const restored = undoClear(
    {
      ...history,
      undo: {
        ...saved,
        layers: {
          media: restore('media'),
          slide: restore('slide'),
          prop: restore('prop'),
          audio: restore('audio'),
          message: restore('message'),
          notice: restore('notice'),
        },
      },
    },
    context,
  );
  const remaining = Object.fromEntries(
    Object.entries(history.clearSnapshots ?? {}).filter(
      ([key]) => key !== target,
    ),
  );
  return withClearSnapshots(restored, remaining);
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
    history.state.layers.message === null ||
    undo.clearedMessageIds !== undefined
      ? resumedMessages(undo.layers.message, elapsed, undo.clearedMessageIds)
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
          version: nextAudioTrackVersion(history.state, undo.layers.audio),
        })
      : undo.layers.audio;
  const restored = withLayers(
    history,
    {...undo.layers, media, message, notice, audio},
    null,
  );
  const withStage =
    undo.stageMessage === undefined
      ? restored
      : {
          ...restored,
          state: {...restored.state, stageMessage: undo.stageMessage},
        };
  return audio !== undo.layers.audio && audio?.playback !== undefined
    ? {
        ...withStage,
        state: {
          ...withStage.state,
          audioTrackVersion: audio.playback.trackVersion,
        },
      }
    : withStage;
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
      ...(playback.fadeOutSince === undefined
        ? {}
        : {
            fadeOutSince:
              playback.fadeOutSince + Math.max(0, clock.now - clock.clearedAt),
          }),
    },
  };
}

function resumedMessages(
  layer: MessageLayer | null,
  elapsed: number,
  ids?: readonly MessageId[],
): MessageLayer | null {
  if (layer?.items === undefined) return layer;
  return {
    ...layer,
    items: layer.items.map(item =>
      ids !== undefined && !ids.includes(item.messageId)
        ? item
        : {
            ...item,
            startedAt: item.startedAt + elapsed,
            expiresAt:
              item.expiresAt === null ? null : item.expiresAt + elapsed,
          },
    ),
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
  commands: [
    'layer.clear',
    'layer.clear.toggle',
    'clear.undo',
    'overlay.clear',
  ],
  initial: {canUndo: false},
  reduce: (history, command, context) => {
    switch (command.type) {
      case 'layer.clear':
        return withClearEffects(
          history,
          clear(history, command.target, context),
          {
            transition: command.transition,
            now: context.timerNow ?? context.now,
          },
        );
      case 'layer.clear.toggle':
        return withClearEffects(
          history,
          toggleClear(history, command.target, context),
          {
            transition:
              context.settings?.preferences().clearKeys[command.target],
            now: context.timerNow ?? context.now,
          },
        );
      case 'clear.undo':
        return history.undo === null
          ? history
          : resetClearToggles(undoClear(history, context));
      case 'overlay.clear':
        return withClearEffects(
          history,
          clearOverlay(history, command.target, context.now),
          {
            transition: command.transition,
            now: context.timerNow ?? context.now,
          },
        );
    }
  },
});
