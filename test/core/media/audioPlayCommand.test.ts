import {describe, expect, it} from 'vitest';
import {createAudioPlaylistId, createMediaId} from '@core/schema/common/ids';
import type {AudioLayer} from '@core/schema/live/live';
import type {AudioPlaylist} from '@core/schema/media/mediaList';
import {audioPlayCommand} from '@core/media/audioPlayCommand';

const TRACK = createMediaId('00000000-0000-4000-8000-0000000000a1');
const PLAYLIST: AudioPlaylist = {
  id: createAudioPlaylistId('00000000-0000-4000-8000-0000000000b1'),
  name: '예배 전 음악',
  items: [TRACK],
  loop: false,
};

function audio(since: number | null): AudioLayer {
  return {
    mediaId: TRACK,
    playback: {
      source: {kind: 'media', mediaId: TRACK},
      trackVersion: 1,
      positionSeconds: 12,
      since,
    },
  };
}

describe('audioPlayCommand', () => {
  it('pauses a track that plays and resumes one that is held', () => {
    const playing = {
      audio: audio(1000),
      selected: PLAYLIST,
      playable: true,
    };
    expect(audioPlayCommand(playing)).toEqual({type: 'audio.pause'});
    expect(audioPlayCommand({...playing, audio: audio(null)})).toEqual({
      type: 'audio.play',
    });
  });

  it('starts the chosen playlist from its first track when nothing plays', () => {
    expect(
      audioPlayCommand({audio: null, selected: PLAYLIST, playable: true}),
    ).toEqual({
      type: 'audio.play',
      source: {kind: 'playlist', playlistId: PLAYLIST.id, position: 0},
    });
  });

  it('does nothing without a playlist, with an empty one, or when none of its tracks can play', () => {
    const none = {audio: null, playable: true};
    expect(audioPlayCommand({...none, selected: undefined})).toBeNull();
    expect(
      audioPlayCommand({...none, selected: {...PLAYLIST, items: []}}),
    ).toBeNull();
    expect(
      audioPlayCommand({...none, selected: PLAYLIST, playable: false}),
    ).toBeNull();
  });
});
