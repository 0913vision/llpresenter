import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SongPicker} from '@renderer/features/service/items/SongPicker';

const id = createSongId('10000000-0000-4000-8000-000000000001');
const secondId = createSongId('10000000-0000-4000-8000-000000000002');
const thirdId = createSongId('10000000-0000-4000-8000-000000000003');

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

it.each(['enter', 'double click'] as const)(
  'chooses a song with %s',
  async method => {
    window.llp = mockLlpApi({
      songs: {
        list: async () => [
          {id, title: '첫 곡', slideCount: 1, access: 'editable', usedBy: []},
        ],
      },
    });
    const choose = vi.fn();
    render(<SongPicker onChoose={choose} onClose={vi.fn()} />);
    const row = await screen.findByRole('option', {name: '첫 곡'});
    const user = userEvent.setup();
    if (method === 'enter') {
      await user.click(row);
      await user.keyboard('{Enter}');
    } else {
      await user.dblClick(row);
    }
    expect(choose).toHaveBeenCalledExactlyOnceWith(id);
  },
);

it('chooses the highlighted song with Enter in the search field', async () => {
  window.llp = mockLlpApi({
    songs: {
      list: async () => [
        {id, title: '첫 곡', slideCount: 1, access: 'editable', usedBy: []},
      ],
    },
  });
  const choose = vi.fn();
  render(<SongPicker onChoose={choose} onClose={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('option', {name: '첫 곡'}));
  await user.click(screen.getByRole('combobox', {name: '곡 검색'}));
  await user.keyboard('{Enter}');
  expect(choose).toHaveBeenCalledExactlyOnceWith(id);
});

it.each([
  {keys: '', expected: id, label: 'first'},
  {keys: '{ArrowDown}{ArrowDown}', expected: thirdId, label: 'third'},
])(
  'chooses the $label matching song from the search field',
  async ({keys, expected}) => {
    const songs = [
      {
        id,
        title: '평안 하나',
        slideCount: 1,
        access: 'editable' as const,
        usedBy: [],
      },
      {
        id: secondId,
        title: '평안 둘',
        slideCount: 1,
        access: 'editable' as const,
        usedBy: [],
      },
      {
        id: thirdId,
        title: '평안 셋',
        slideCount: 1,
        access: 'editable' as const,
        usedBy: [],
      },
    ];
    window.llp = mockLlpApi({
      songs: {list: async () => songs},
      library: {
        search: async ({query}) => ({
          query,
          matches: songs
            .filter(song => song.title.includes(query))
            .map(song => ({
              songId: song.id,
              title: song.title,
              slideCount: song.slideCount,
              match: {kind: 'title' as const},
            })),
        }),
      },
    });
    const choose = vi.fn();
    render(<SongPicker onChoose={choose} onClose={vi.fn()} />);
    const user = userEvent.setup();
    const field = screen.getByRole('combobox', {name: '곡 검색'});
    await user.type(field, '평안');
    const first = await screen.findByRole('option', {
      name: '평안 하나',
      selected: true,
    });
    expect(field.getAttribute('aria-activedescendant')).toBe(first.id);
    expect(document.activeElement).toBe(field);
    if (keys !== '') {
      await user.keyboard(keys);
    }
    const active = field.getAttribute('aria-activedescendant');
    expect(
      active === null
        ? null
        : document.getElementById(active)?.getAttribute('data-value'),
    ).toBe(expected);
    expect(document.activeElement).toBe(field);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
    });
    await user.keyboard('{Enter}');
    expect(choose).toHaveBeenCalledExactlyOnceWith(expected);
  },
);

it('does not add when there are no results and closes on Escape', async () => {
  window.llp = mockLlpApi({
    songs: {
      list: async () => [
        {id, title: '첫 곡', slideCount: 1, access: 'editable', usedBy: []},
      ],
    },
    library: {search: async ({query}) => ({query, matches: []})},
  });
  const choose = vi.fn();
  const close = vi.fn();
  render(<SongPicker onChoose={choose} onClose={close} />);
  const user = userEvent.setup();
  const field = screen.getByRole('combobox', {name: '곡 검색'});
  await user.type(field, '없는 곡');
  await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
  expect(
    screen.getByRole('button', {name: '추가'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(field.getAttribute('aria-activedescendant')).toBeNull();
  await user.keyboard('{Enter}');
  expect(choose).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(close).toHaveBeenCalledOnce();
});
