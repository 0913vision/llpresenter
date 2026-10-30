import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseMediaList} from '@core/schema/mediaList';
import {expectSuccess} from '@core/schema/testHelpers';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {audioTracks} from './audioTracks';
import {AudioTrackRow} from './AudioTrackRow';

afterEach(cleanup);

it('plays the selected occurrence and disables an unavailable track', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const list = '00000000-0000-4000-8000-000000000002';
  const {data} = expectSuccess(
    parseMediaList(
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {
            id,
            name: 'Track',
            kind: 'audio',
            file: 'track.wav',
            size: 1,
            duration: 75,
          },
        ],
        playlists: [],
        audioPlaylists: [
          {
            id: list,
            name: 'List',
            loop: false,
            items: [id, id, '00000000-0000-4000-8000-000000000003'],
          },
        ],
      }),
      'media.json',
    ),
  );
  const send = vi.fn();
  const api = fakeLlpApi({live: {send}});
  const playlist = data.audioPlaylists[0];
  if (!playlist) throw new Error('Missing playlist fixture');
  const tracks = audioTracks(playlist, data.items, undefined);
  render(
    <>
      {tracks.map(track => (
        <AudioTrackRow key={track.position} api={api} track={track} />
      ))}
    </>,
  );
  const rows = screen.getAllByRole('button');
  expect(rows[1]?.textContent).toContain('1:15');
  const second = rows[1];
  const third = rows[2];
  if (!second || !(third instanceof HTMLButtonElement)) {
    throw new Error('Missing rows');
  }
  fireEvent.click(second);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'audio.play',
    source: {kind: 'playlist', playlistId: list, position: 1},
  });
  expect(third.disabled).toBe(true);
});
