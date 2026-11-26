import {describe, expect, it} from 'vitest';
import {createAudioPlaylistId, createMediaId} from '@core/schema/common/ids';
import type {AudioPlaylist} from '@core/schema/media/mediaList';
import {audioPlayCommand} from '@core/media/audioPlayCommand';

const TRACK = createMediaId('00000000-0000-4000-8000-0000000000a1');
const PLAYLIST: AudioPlaylist = {
  id: createAudioPlaylistId('00000000-0000-4000-8000-0000000000b1'),
  name: '예배 전 음악',
  items: [TRACK],
  loop: false,
};

describe('audioPlayCommand', () => {
  it('hands main the chosen playlist from its first track to start when nothing plays', () => {
    expect(audioPlayCommand({selected: PLAYLIST, playable: true})).toEqual({
      type: 'audio.toggle',
      source: {kind: 'playlist', playlistId: PLAYLIST.id, position: 0},
    });
  });

  it('hands main nothing to start without a playlist, with an empty one, or when none of its tracks can play', () => {
    expect(audioPlayCommand({selected: undefined, playable: true})).toEqual({
      type: 'audio.toggle',
    });
    expect(
      audioPlayCommand({selected: {...PLAYLIST, items: []}, playable: true}),
    ).toEqual({type: 'audio.toggle'});
    expect(audioPlayCommand({selected: PLAYLIST, playable: false})).toEqual({
      type: 'audio.toggle',
    });
  });
});
