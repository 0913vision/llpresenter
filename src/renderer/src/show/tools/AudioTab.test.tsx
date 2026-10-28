import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {parseMediaDocument, type MediaDocument} from '@shared/schema/mediaEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {AudioTab} from './AudioTab';

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
});
const track = '00000000-0000-4000-8000-000000000001';
const first = '00000000-0000-4000-8000-000000000002';
const second = '00000000-0000-4000-8000-000000000003';
function fixture(missing = false) {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: track,
          name: 'Track',
          kind: 'audio',
          file: 'track.wav',
          size: 1,
          duration: 65,
        },
      ],
      playlists: [],
      audioPlaylists: [
        {id: first, name: 'First', loop: false, items: [track, track]},
        {id: second, name: 'Second', loop: true, items: [track]},
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid fixture');
  let push: (document: MediaDocument) => void = () => undefined;
  const stop = vi.fn();
  const send = vi.fn();
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: first, revision: 2}});
  const api = fakeLlpApi({
    media: {
      get: async () => parsed.value,
      edit,
      subscribe: listener => {
        push = listener;
        return stop;
      },
      missing: async () =>
        missing ? parsed.value.value.items.map(item => item.id) : [],
    },
    live: {send},
  });
  window.llp = api;
  useLive.setState({state: emptyLiveState()});
  return {
    send,
    edit,
    stop,
    push: (next: MediaDocument) => push(next),
    doc: parsed.value,
  };
}

it('selects a playlist, plays the chosen occurrence and saves repeat', async () => {
  const f = fixture();
  const {unmount} = render(<AudioTab />);
  const select = await screen.findByRole('button', {name: '오디오 재생목록'});
  await waitFor(() => expect(select.textContent).toBe('First'));
  const list = screen.getByRole('list', {name: '오디오 트랙 목록'});
  const tracks = within(list).getAllByRole('button');
  const secondTrack = tracks[1];
  if (!secondTrack) throw new Error('Missing second track');
  fireEvent.click(secondTrack);
  expect(f.send).toHaveBeenLastCalledWith({
    type: 'audio.play',
    source: {kind: 'playlist', playlistId: first, position: 1},
  });
  fireEvent.click(screen.getByRole('switch', {name: '반복'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  expect(f.edit).toHaveBeenCalledWith({
    type: 'media.playlist.update',
    baseRevision: 1,
    playlist: {
      kind: 'audio',
      value: {...f.doc.value.audioPlaylists[0], loop: true},
    },
  });
  await userEvent.click(select);
  await userEvent.click(screen.getByRole('menuitemradio', {name: 'Second'}));
  expect(select.textContent).toBe('Second');
  expect(
    screen.getByRole('switch', {name: '반복'}).getAttribute('aria-checked'),
  ).toBe('true');
  unmount();
  expect(f.stop).toHaveBeenCalledOnce();
});

it('does not start a missing file from the row or transport', async () => {
  const f = fixture(true);
  render(<AudioTab />);
  const list = await screen.findByRole('list', {name: '오디오 트랙 목록'});
  await waitFor(() =>
    expect(
      within(list)
        .getAllByRole('button')
        .every(
          button => button instanceof HTMLButtonElement && button.disabled,
        ),
    ).toBe(true),
  );
  const play = screen.getByRole('button', {name: '재생'});
  expect(play.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(play);
  expect(f.send).not.toHaveBeenCalled();
});

it('updates and clears a deleted selection without retaining old tracks', async () => {
  const f = fixture();
  render(<AudioTab />);
  await screen.findByRole('list', {name: '오디오 트랙 목록'});
  act(() =>
    f.push({
      ...f.doc,
      revision: 2,
      value: {...f.doc.value, audioPlaylists: []},
    }),
  );
  expect(screen.queryByRole('list', {name: '오디오 트랙 목록'})).toBeNull();
  expect(screen.getByText('오디오 재생목록이 없습니다')).toBeDefined();
});
