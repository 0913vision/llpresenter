import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {parseGroupedSong, type GroupedSong} from '@shared/schema/groupedSong';
import {createSongId, createSongGroupId} from '@shared/schema/ids';
import {assignSlideHotKey, slideHotKeyView} from './slideHotKeyEditing';
import {GroupedSlideHotKeyDialog} from './GroupedSlideHotKeyDialog';

const songId = createSongId('00000000-0000-4000-8000-000000000001');
const first = createSongGroupId('00000000-0000-4000-8000-000000000002');
const second = createSongGroupId('00000000-0000-4000-8000-000000000003');
const source = {songId, groupId: second, slideIndex: 1};
function fixture() {
  const parsed = parseGroupedSong(
    JSON.stringify({
      format: 'llsong',
      schemaVersion: 2,
      id: songId,
      title: 'Invented song',
      groups: [
        {
          id: first,
          name: '후렴',
          slides: [{lines: ['Invented first line'], hotKey: 'KeyA'}],
        },
        {
          id: second,
          name: '후렴',
          slides: [
            {lines: ['Invented second line']},
            {lines: ['Invented third line'], future: {retained: true}},
          ],
        },
      ],
      arrangements: [{name: 'Repeat', groups: [second, first, second]}],
    }),
    'invented.llsong',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.data;
}
afterEach(cleanup);

it('edits the particular grouped source once and preserves repeats, identities and unknown fields', () => {
  const song = fixture();
  const view = slideHotKeyView(song, source);
  expect(view).toEqual({
    slideNumber: 3,
    value: undefined,
    otherAssignments: [{code: 'KeyA', slideNumber: 1}],
  });
  const changed = assignSlideHotKey(song, source, 'KeyC');
  if (!changed.ok) throw new Error(changed.error);
  expect(changed.value.groups[1]?.slides[1]).toEqual({
    lines: ['Invented third line'],
    future: {retained: true},
    hotKey: 'KeyC',
  });
  expect(changed.value.groups[0]).toBe(song.groups[0]);
  expect(changed.value.groups[1]?.slides[0]).toBe(song.groups[1]?.slides[0]);
  expect(changed.value.arrangements).toBe(song.arrangements);
  expect(song.groups[1]?.slides[1]?.hotKey).toBeUndefined();
  const unchanged = assignSlideHotKey(changed.value, source, 'KeyC');
  expect(unchanged.ok && unchanged.value === changed.value).toBe(true);
  const cleared = assignSlideHotKey(changed.value, source, undefined);
  if (!cleared.ok) throw new Error(cleared.error);
  expect(cleared.value).toEqual(song);
});

it('refuses duplicate/invalid assignments and mismatched or missing source identities', () => {
  const song = fixture();
  expect(assignSlideHotKey(song, source, 'KeyA')).toEqual({
    ok: false,
    error: 'duplicate-key',
  });
  expect(assignSlideHotKey(song, source, 'F1')).toEqual({
    ok: false,
    error: 'invalid-key',
  });
  expect(
    assignSlideHotKey(
      song,
      {...source, songId: createSongId('00000000-0000-4000-8000-000000000004')},
      'KeyC',
    ),
  ).toEqual({ok: false, error: 'missing-source'});
  expect(assignSlideHotKey(song, {...source, slideIndex: 9}, 'KeyC')).toEqual({
    ok: false,
    error: 'missing-source',
  });
  expect(
    assignSlideHotKey(
      song,
      {
        ...source,
        groupId: createSongGroupId('00000000-0000-4000-8000-000000000004'),
      },
      'KeyC',
    ),
  ).toEqual({ok: false, error: 'missing-source'});
});

it.each(['', 'KeyAA', 'Digit10', 'Numpad1', 'ControlLeft', 'Keya'])(
  'refuses the invalid stored key %s without changing the song',
  code => {
    const song = fixture();
    expect(assignSlideHotKey(song, source, code)).toEqual({
      ok: false,
      error: 'invalid-key',
    });
    expect(song.groups[1]?.slides[1]?.hotKey).toBeUndefined();
  },
);

it('binds the editor recorder to the agreed grouped field without assigning another same-label slide', async () => {
  const song = fixture();
  const onChange = vi.fn<(next: GroupedSong) => boolean>(() => true);
  const onClose = vi.fn();
  render(
    <GroupedSlideHotKeyDialog
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
    groups: [
      {id: first, slides: [{hotKey: 'KeyA'}]},
      {
        id: second,
        slides: [{lines: ['Invented second line']}, {hotKey: 'KeyC'}],
      },
    ],
  });
  expect(onClose).toHaveBeenCalledOnce();
});

it('blocks a draft after the source revision changes and closes when the source disappears', async () => {
  const song = fixture();
  const onChange = vi.fn<(next: GroupedSong) => boolean>(() => true);
  const onClose = vi.fn();
  const view = render(
    <GroupedSlideHotKeyDialog
      song={song}
      source={source}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  fireEvent.keyDown(screen.getByRole('textbox'), {key: 'c', code: 'KeyC'});
  view.rerender(
    <GroupedSlideHotKeyDialog
      song={{...song, title: 'Changed song'}}
      source={source}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(
    <GroupedSlideHotKeyDialog
      song={song}
      source={{...source, slideIndex: 9}}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onClose).toHaveBeenCalledOnce();
});

it('keeps a refused owner edit open and does not move a draft to another valid source', async () => {
  const song = fixture();
  const onChange = vi.fn<(next: GroupedSong) => boolean>(() => false);
  const onClose = vi.fn();
  const view = render(
    <GroupedSlideHotKeyDialog
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
    <GroupedSlideHotKeyDialog
      song={song}
      source={{...source, slideIndex: 0}}
      onChange={onChange}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
});
