import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {parseMediaList} from '@core/schema/mediaList';
import {expectSuccess} from '@core/schema/testHelpers';
import {AudioTransport} from './AudioTransport';

afterEach(cleanup);
it('starts the selected playlist, resumes or pauses playback, and sends transport controls', () => {
  const itemId = '00000000-0000-4000-8000-000000000001';
  const playlistId = '00000000-0000-4000-8000-000000000002';
  const {data} = expectSuccess(
    parseMediaList(
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {
            id: itemId,
            name: 'Track',
            kind: 'audio',
            file: 'track.wav',
            size: 1,
            duration: 120,
          },
        ],
        playlists: [],
        audioPlaylists: [
          {id: playlistId, name: 'List', loop: false, items: [itemId]},
        ],
      }),
      'media.json',
    ),
  );
  const send = vi.fn();
  const api = fakeLlpApi({live: {send}});
  const playlist = data.audioPlaylists[0];
  if (!playlist) throw new Error('Missing playlist fixture');
  const {rerender} = render(
    <AudioTransport
      api={api}
      audio={null}
      items={data.items}
      selected={playlist}
      volume={100}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '재생'}));
  expect(send).toHaveBeenLastCalledWith({
    type: 'audio.play',
    source: {kind: 'playlist', playlistId, position: 0},
  });
  const audio = {
    mediaId: itemId,
    playback: {
      source: {
        kind: 'playlist' as const,
        playlistId: playlist.id,
        position: 0,
      },
      trackVersion: 1,
      since: null,
      positionSeconds: 65,
    },
  };
  rerender(
    <AudioTransport
      api={api}
      audio={audio}
      items={data.items}
      selected={playlist}
      volume={50}
    />,
  );
  expect(screen.getByText('1:05 / 2:00')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: '재생'}));
  expect(send).toHaveBeenLastCalledWith({type: 'audio.play'});
  fireEvent.click(screen.getByRole('button', {name: '이전'}));
  expect(send).toHaveBeenLastCalledWith({type: 'audio.previous'});
  fireEvent.click(screen.getByRole('button', {name: '다음'}));
  expect(send).toHaveBeenLastCalledWith({type: 'audio.next'});
  fireEvent.click(screen.getByRole('button', {name: '페이드 아웃'}));
  expect(send).toHaveBeenLastCalledWith({type: 'audio.fadeOut'});
  rerender(
    <AudioTransport
      api={api}
      audio={{
        ...audio,
        playback: {
          ...audio.playback,
          since: performance.timeOrigin + performance.now(),
        },
      }}
      items={data.items}
      selected={playlist}
      volume={50}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '일시 정지'}));
  expect(send).toHaveBeenLastCalledWith({type: 'audio.pause'});
});
