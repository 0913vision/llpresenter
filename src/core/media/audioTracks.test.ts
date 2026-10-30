import {expect, it} from 'vitest';
import {parseMediaList} from '../schema/mediaList';
import {expectSuccess} from '../schema/testHelpers';
import {audioTracks} from './audioTracks';

const id = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

it('keeps repeated and missing tracks at their playlist positions', () => {
  const {data} = expectSuccess(
    parseMediaList(
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {id: id(1), name: 'Track', kind: 'audio', file: 'track.wav', size: 1},
          {id: id(2), name: 'Image', kind: 'image', file: 'image.png', size: 1},
        ],
        playlists: [],
        audioPlaylists: [
          {
            id: id(3),
            name: 'List',
            loop: false,
            items: [id(1), id(4), id(1), id(2)],
          },
          {id: id(5), name: 'Other', loop: false, items: [id(1)]},
        ],
      }),
      'media.json',
    ),
  );
  const playlist = data.audioPlaylists[0];
  const other = data.audioPlaylists[1];
  const item = data.items[0];
  if (!playlist || !other || !item) throw new Error('Missing fixture');
  const active = {
    kind: 'playlist',
    playlistId: playlist.id,
    position: 2,
  } as const;
  const tracks = audioTracks(playlist, data.items, active);
  expect(tracks.map(track => track.position)).toEqual([0, 1, 2, 3]);
  expect(tracks.map(track => track.item?.name)).toEqual([
    'Track',
    undefined,
    'Track',
    undefined,
  ]);
  expect(tracks.map(track => track.playing)).toEqual([
    false,
    false,
    true,
    false,
  ]);
  expect(tracks[2]?.source).toEqual(active);
  expect(tracks.map(track => track.missing)).toEqual([
    false,
    true,
    false,
    true,
  ]);
  expect(audioTracks(other, data.items, active)[0]?.playing).toBe(false);
  expect(
    audioTracks(playlist, data.items, {
      kind: 'media',
      mediaId: item.id,
    }).some(track => track.playing),
  ).toBe(false);
});
