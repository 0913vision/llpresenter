import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {parseSong, type Song} from '@core/schema/song';
import {createSongId} from '@core/schema/ids';
import {SongSlideHotKeyDialog} from '@renderer/features/songs/editor/SongSlideHotKeyDialog';

const songId = createSongId('00000000-0000-4000-8000-000000000001');

const source = {songId, slideId: fixtureSlideId(3)};
function fixture() {
  const parsed = parseSong(
    JSON.stringify({
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: 'Invented song',
      slides: [
        {
          id: fixtureSlideId(1),
          lines: ['Invented first line'],
          hotKey: 'KeyA',
          label: '후렴',
        },
        {id: fixtureSlideId(2), lines: ['Invented second line'], label: '후렴'},
        {
          id: fixtureSlideId(3),
          lines: ['Invented third line'],
          future: {retained: true},
          label: '후렴',
        },
      ],
    }),
    'invented.llsong',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.data;
}
afterEach(cleanup);

it('binds the editor recorder to the agreed grouped field without assigning another same-label slide', async () => {
  const song = fixture();
  const onChange = vi.fn<(next: Song) => boolean>(() => true);
  const onClose = vi.fn();
  render(
    <SongSlideHotKeyDialog
      song={song}
      source={source}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  fireEvent.keyDown(screen.getByRole('textbox'), {key: 'c', code: 'KeyC'});
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0]?.[0]).toMatchObject({
    slides: [
      {hotKey: 'KeyA'},
      {lines: ['Invented second line']},
      {hotKey: 'KeyC'},
    ],
  });
  expect(onClose).toHaveBeenCalledOnce();
});

it('blocks a draft after the source revision changes and closes when the source disappears', async () => {
  const song = fixture();
  const onChange = vi.fn<(next: Song) => boolean>(() => true);
  const onClose = vi.fn();
  const view = render(
    <SongSlideHotKeyDialog
      song={song}
      source={source}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  fireEvent.keyDown(screen.getByRole('textbox'), {key: 'c', code: 'KeyC'});
  view.rerender(
    <SongSlideHotKeyDialog
      song={{...song, title: 'Changed song'}}
      source={source}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(
    <SongSlideHotKeyDialog
      song={song}
      source={{...source, slideId: fixtureSlideId(9)}}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onClose).toHaveBeenCalledOnce();
});

it('keeps a refused owner edit open and does not move a draft to another valid source', async () => {
  const song = fixture();
  const onChange = vi.fn<(next: Song) => boolean>(() => false);
  const onClose = vi.fn();
  const view = render(
    <SongSlideHotKeyDialog
      song={song}
      source={source}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  fireEvent.keyDown(screen.getByRole('textbox'), {key: 'c', code: 'KeyC'});
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
  view.rerender(
    <SongSlideHotKeyDialog
      song={song}
      source={{...source, slideId: fixtureSlideId(2)}}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
});
