import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SongPicker} from '@renderer/features/service/items/SongPicker';

const id = createSongId('10000000-0000-4000-8000-000000000001');

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
  await user.click(screen.getByRole('textbox', {name: '곡 검색'}));
  await user.keyboard('{Enter}');
  expect(choose).toHaveBeenCalledExactlyOnceWith(id);
});
