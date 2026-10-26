import type {AudioSource} from '@shared/schema/liveActions';
import {audioPositionSeconds} from '@shared/schema/audioState';
import {MissingLiveTargetError} from '../commandErrors';
import {setLayer, type LiveHistory} from '../history';
import {defineSlice, type SliceContext} from '../slice';
import {nextAudioTrackVersion} from '../audioTrackVersion';

function play(
  history: LiveHistory,
  source: AudioSource,
  context: SliceContext,
): LiveHistory {
  const media = context.audioMedia?.();
  if (media === undefined) throw new Error('Audio media is unavailable');
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
  if (item === undefined) {
    throw new MissingLiveTargetError({kind: 'audio', id: mediaId});
  }
  const trackVersion = nextAudioTrackVersion(history.state);
  const next = setLayer(history, 'audio', {
    mediaId,
    playback: {
      source,
      trackVersion,
      positionSeconds: 0,
      since: context.timerNow ?? context.now,
    },
  });
  return {...next, state: {...next.state, audioTrackVersion: trackVersion}};
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
  const playlist = context
    .audioMedia?.()
    .audioPlaylists.find(({id}) => id === source.playlistId);
  if (playlist === undefined) {
    throw new MissingLiveTargetError({
      kind: 'audio playlist',
      id: source.playlistId,
    });
  }
  const next = Math.max(0, source.position + direction);
  if (next >= playlist.items.length && !playlist.loop) {
    return setLayer(history, 'audio', null);
  }
  return play(
    history,
    {...source, position: next >= playlist.items.length ? 0 : next},
    context,
  );
}

/** Audio transport is independent of screens, Looks, and the control window. */
export const audioSlice = defineSlice({
  commands: [
    'audio.play',
    'audio.pause',
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
        const next = setLayer(
          history,
          'audio',
          {
            ...layer,
            playback: {
              source: playback.source,
              trackVersion,
              positionSeconds: playback.positionSeconds,
              since: playback.since ?? now,
            },
          },
          {preserveClearToggles: true},
        );
        return playback.fadeOutSince === undefined
          ? next
          : {...next, state: {...next.state, audioTrackVersion: trackVersion}};
      }
      case 'audio.pause':
        if (layer?.playback === undefined || layer.playback.since === null) {
          return history;
        }
        return setLayer(
          history,
          'audio',
          {
            ...layer,
            playback: {
              ...layer.playback,
              positionSeconds: audioPositionSeconds(layer.playback, now),
              since: null,
            },
          },
          {preserveClearToggles: true},
        );
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
        return setLayer(
          history,
          'audio',
          {
            ...layer,
            playback: {...layer.playback, fadeOutSince: now},
          },
          {preserveClearToggles: true},
        );
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
