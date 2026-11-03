import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {setup} from '@fixtures/renderer/features/songs/library/libraryPanelFixtures';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';

describe('library panel menu rows', () => {
  it('makes a new song when the 새 곡 request arrives, once', async () => {
    const fixture = libraryFixture();
    const edit = vi.spyOn(fixture.api.content, 'edit');
    const handled = vi.fn();
    const onOpenSong = vi.fn();
    const view = render(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={onOpenSong}
        onProblem={vi.fn()}
      />,
    );
    await screen.findAllByRole('option');
    const request = {kind: 'create'} as const;
    view.rerender(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={onOpenSong}
        onProblem={vi.fn()}
        selectionRequest={request}
        onSelectionHandled={handled}
      />,
    );
    await waitFor(() => expect(onOpenSong).toHaveBeenCalledOnce());
    expect(edit).toHaveBeenCalledExactlyOnceWith({type: 'song.create'});
    expect(onOpenSong).toHaveBeenCalledWith(
      expect.objectContaining({focusTitle: true}),
    );
    expect(handled).toHaveBeenCalledExactlyOnceWith(request);
  });

  it('renames a song by the title rule of 곡 편집 and refuses a title another song has', async () => {
    const {fixture, user} = await setup();
    const edit = vi.spyOn(fixture.api.content, 'edit');
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const dialog = await screen.findByRole('dialog', {name: '곡 이름 바꾸기'});
    const field = within(dialog).getByRole('textbox', {name: '곡 제목'});
    const save = within(dialog).getByRole('button', {name: '저장'});

    fireEvent.change(field, {target: {value: '   '}});
    expect(save.getAttribute('aria-disabled')).toBe('true');
    const other = fixture.list().find(song => song.title !== '찬송 10');
    if (other === undefined) throw new Error('Missing second song');
    fireEvent.change(field, {target: {value: other.title}});
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(edit).not.toHaveBeenCalled();

    fireEvent.change(field, {target: {value: '  새 제목  '}});
    expect(save.getAttribute('aria-disabled')).toBeNull();
    await user.click(save);
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    const [sent] = edit.mock.calls[0] ?? [];
    if (sent?.type !== 'song.update') throw new Error('Expected a song update');
    expect(sent.song.title).toBe('새 제목');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: '곡 이름 바꾸기'})).toBeNull(),
    );
    expect(fixture.list().some(song => song.title === '새 제목')).toBe(true);
  });

  it('shows the song file by id only', async () => {
    const {fixture, user} = await setup();
    const reveal = vi.spyOn(fixture.api.library, 'revealSong');
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '탐색기에서 보기'}));
    const song = fixture.list().find(value => value.title === '찬송 10');
    expect(reveal).toHaveBeenCalledExactlyOnceWith(song?.id);
  });
});
