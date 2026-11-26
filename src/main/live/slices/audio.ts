import type {MediaId} from '@core/schema/common/ids';
import type {AudioSource} from '@core/schema/live/liveActions';
import {audioPositionSeconds} from '@core/schema/media/audioState';
import {outputMediaProperties} from '@core/schema/media/outputMedia';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, updateLayer, type LiveHistory} from '../history';
import {defineSlice, type SliceContext} from '../slice';
import {nextAudioTrackVersion} from '../media/audioTrackVersion';

type AudioMedia = NonNullable<
  ReturnType<NonNullable<SliceContext['audioMedia']>>
>;
type AudioPlaylist = AudioMedia['audioPlaylists'][number];

/** A playlist with the check of which of its tracks can play. */
interface PlayableList {
  readonly playlist: AudioPlaylist;
  readonly canPlay: (mediaId: MediaId) => boolean;
}

/** A track can play when it is an audio item of the list whose file isn't missing. */
function playableList(
  playlist: AudioPlaylist,
  media: AudioMedia,
  {isMissingMedia}: Pick<SliceContext, 'isMissingMedia'>,
): PlayableList {
  return {
    playlist,
    canPlay: mediaId =>
      media.items.some(({id, kind}) => id === mediaId && kind === 'audio') &&
      isMissingMedia?.(mediaId) !== true,
  };
}

/**
 * The first position from `start` on, going `step`, whose track can play, or
 * undefined for none. Going forward it wraps past the end only in a looping
 * playlist.
 */
function playablePosition(
  {playlist, canPlay}: PlayableList,
  start: number,
  step: -1 | 1,
): number | undefined {
  // NOTE(0913vision): A track whose file is missing is skipped (USER Nov 26
  // "건너뛰고 다음 곡"), so a list never stops on it with a failure card.
  let at = start;
  let checked = 0;
  while (checked < playlist.items.length) {
    if (at >= playlist.items.length) {
      if (!playlist.loop) return undefined;
      at = 0;
    }
    const mediaId = playlist.items[at];
    if (at < 0 || mediaId === undefined) return undefined;
    if (canPlay(mediaId)) return at;
    at += step;
    checked++;
  }
  return undefined;
}

function play(
  history: LiveHistory,
  requested: AudioSource,
  context: SliceContext,
): LiveHistory {
  const media = context.audioMedia?.();
  if (media === undefined) throw new Error('Audio media is unavailable');
  const source = playableSource(requested, media, context);
  const mediaId =
    source.kind === 'media'
      ? source.mediaId
      : media.audioPlaylists.find(({id}) => id === source.playlistId)?.items[
          source.position
        ];
  if (mediaId === undefined) {
    throw new MissingLiveTargetError({
      kind: 'audio playlist track',
      id: source.kind === 'playlist' ? source.playlistId : source.mediaId,
    });
  }
  const item = media.items.find(
    ({id, kind}) => id === mediaId && kind === 'audio',
  );
  if (item === undefined || context.isMissingMedia?.(item.id) === true) {
    throw new MissingLiveTargetError({kind: 'audio', id: mediaId});
  }
  const trackVersion = nextAudioTrackVersion(history.state);
  const next = setLayer(history, 'audio', {
    mediaId,
    properties: outputMediaProperties(item),
    playback: {
      source,
      trackVersion,
      positionSeconds: 0,
      since: context.timerNow ?? context.now,
    },
  });
  return {...next, state: {...next.state, audioTrackVersion: trackVersion}};
}

/** A playlist track that can play, from the requested one on. */
function playableSource(
  source: AudioSource,
  media: AudioMedia,
  context: SliceContext,
): AudioSource {
  if (source.kind === 'media') return source;
  const playlist = media.audioPlaylists.find(
    ({id}) => id === source.playlistId,
  );
  if (playlist === undefined) return source;
  const position = playablePosition(
    playableList(playlist, media, context),
    source.position,
    1,
  );
  return position === undefined ? source : {...source, position};
}

function move(
  history: LiveHistory,
  direction: -1 | 1,
  context: SliceContext,
): LiveHistory {
  const source = history.state.layers.audio?.playback?.source;
  if (source === undefined) return history;
  if (source.kind === 'media') {
    return direction === -1
      ? play(history, source, context)
      : setLayer(history, 'audio', null);
  }
  const media = context.audioMedia?.();
  const playlist = media?.audioPlaylists.find(
    ({id}) => id === source.playlistId,
  );
  if (media === undefined || playlist === undefined) {
    throw new MissingLiveTargetError({
      kind: 'audio playlist',
      id: source.playlistId,
    });
  }
  const list = playableList(playlist, media, context);
  const position =
    direction === 1
      ? playablePosition(list, source.position + 1, 1)
      : playablePosition(list, Math.max(0, source.position - 1), -1);
  if (position === undefined) {
    return direction === 1 ? setLayer(history, 'audio', null) : history;
  }
  return play(history, {...source, position}, context);
}

/** Audio transport is independent of screens, 테마, and the control window. */
export const audioSlice = defineSlice({
  commands: [
    'audio.play',
    'audio.pause',
    'audio.toggle',
    'audio.next',
    'audio.previous',
    'audio.volume.set',
    'audio.fadeOut',
    'audio.fadeOut.complete',
  ],
  initial: {},
  reduce: (history, command, context) => {
    const layer = history.state.layers.audio;
    const now = context.timerNow ?? context.now;
    switch (command.type) {
      case 'audio.play': {
        if (command.source !== undefined) {
          return play(history, command.source, context);
        }
        if (
          layer?.playback === undefined ||
          (layer.playback.since !== null &&
            layer.playback.fadeOutSince === undefined)
        ) {
          return history;
        }
        const playback = layer.playback;
        const trackVersion =
          playback.fadeOutSince === undefined
            ? playback.trackVersion
            : nextAudioTrackVersion(history.state);
        const next = updateLayer(history, 'audio', {
          ...layer,
          playback: {
            source: playback.source,
            trackVersion,
            positionSeconds: playback.positionSeconds,
            since: playback.since ?? now,
          },
        });
        return playback.fadeOutSince === undefined
          ? next
          : {...next, state: {...next.state, audioTrackVersion: trackVersion}};
      }
      case 'audio.pause':
        if (layer?.playback === undefined || layer.playback.since === null) {
          return history;
        }
        return updateLayer(history, 'audio', {
          ...layer,
          playback: {
            ...layer.playback,
            positionSeconds: audioPositionSeconds(
              layer.playback,
              now,
              layer.properties?.speed,
            ),
            since: null,
          },
        });
      case 'audio.toggle':
        if (layer?.playback !== undefined) {
          return context.apply(
            history,
            layer.playback.since === null
              ? {type: 'audio.play'}
              : {type: 'audio.pause'},
          );
        }
        return command.source === undefined
          ? history
          : context.apply(history, {
              type: 'audio.play',
              source: command.source,
            });
      case 'audio.next':
        if (
          command.trackVersion !== undefined &&
          (layer?.playback?.trackVersion !== command.trackVersion ||
            layer.playback.since === null ||
            layer.playback.fadeOutSince !== undefined)
        ) {
          return history;
        }
        return move(history, 1, context);
      case 'audio.previous':
        return move(history, -1, context);
      case 'audio.fadeOut':
        if (
          layer?.playback === undefined ||
          layer.playback.fadeOutSince !== undefined
        ) {
          return history;
        }
        return updateLayer(history, 'audio', {
          ...layer,
          playback: {...layer.playback, fadeOutSince: now},
        });
      case 'audio.fadeOut.complete':
        if (
          layer?.playback?.trackVersion !== command.trackVersion ||
          layer.playback.fadeOutSince !== command.since
        ) {
          return history;
        }
        return setLayer(history, 'audio', null);
      case 'audio.volume.set':
        if ((history.state.audioVolume ?? 100) === command.volume) {
          return history;
        }
        return {
          ...history,
          state: {
            ...history.state,
            audioVolume: command.volume,
            version: history.state.version + 1,
          },
        };
    }
  },
});
