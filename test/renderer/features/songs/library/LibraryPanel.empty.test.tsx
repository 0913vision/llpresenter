import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {setup} from '@fixtures/renderer/features/songs/library/libraryPanelFixtures';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';

afterEach(cleanup);

it('shows 곡 없음 for an empty library', async () => {
  const fixture = libraryFixture([]);
  render(
    <LibraryPanel api={fixture.api} onOpenSong={vi.fn()} onProblem={vi.fn()} />,
  );

  expect((await screen.findByRole('status')).textContent).toBe('곡 없음');
  expect(screen.queryAllByRole('option')).toHaveLength(0);
});

it('shows 검색 결과 없음 for a search with no match, and nothing once the field is cleared', async () => {
  const {user} = await setup();
  const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
  expect(screen.queryByRole('status')).toBeNull();

  await user.type(input, 'zzzzzz');

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('검색 결과 없음'),
  );
  await userEvent.clear(input);
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

it.each(['pending', 'rejected'] as const)(
  'shows no 곡 없음 while the first read is %s',
  async state => {
    const fixture = libraryFixture([]);
    vi.spyOn(fixture.api.songs, 'list').mockImplementation(() =>
      state === 'pending'
        ? new Promise(() => undefined)
        : Promise.reject(new Error('read failed')),
    );
    render(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={vi.fn()}
        onProblem={vi.fn()}
      />,
    );
    await act(() => Promise.resolve());

    expect(screen.queryByRole('status')).toBeNull();
  },
);

it('shows no 검색 결과 없음 while the search is pending or failed', async () => {
  const {fixture, user} = await setup();
  vi.spyOn(fixture.api.library, 'search').mockImplementation(
    () => new Promise(() => undefined),
  );

  await user.type(screen.getByRole('textbox', {name: '라이브러리 검색'}), 'zz');
  await act(() => Promise.resolve());

  expect(screen.queryByRole('status')).toBeNull();
});
