import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {hoverForTooltip} from '@fixtures/renderer/ui/tooltipTesting';
import type {Notice} from '@renderer/ui/notices';
import {
  fixtureSong,
  libraryFixture,
} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';
import {pastDocument} from '@fixtures/core/serviceList';
import {applyService} from '@renderer/session/show';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {setup} from '@fixtures/renderer/features/songs/library/libraryPanelFixtures';

describe('library panel', () => {
  it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
    'opens the focused song menu with $key without selecting it',
    async key => {
      const {onOpenSong} = await setup();
      const opener = screen.getByRole('option', {name: '찬송 10'});
      const selected = opener.getAttribute('aria-selected');
      act(() => opener.focus());
      fireEvent.keyDown(opener, key);
      const menu = screen.getByRole('menu', {name: '곡 메뉴'});
      expect(onOpenSong).not.toHaveBeenCalled();
      expect(opener.getAttribute('aria-selected')).toBe(selected);
      fireEvent.keyDown(menu, {key: 'Escape'});
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(opener);
    },
  );

  it('opens the right-clicked song in the preparation editor', async () => {
    const {onOpenSong, user} = await setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    expect(onOpenSong).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('menuitem', {name: windowCommandLabels.editSong}),
    );
    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixtureSong(1, '찬송 10'),
        focusTitle: false,
      }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('appends the clicked song to the open service in one click', async () => {
    applyService({...sampleService, id: pastDocument.service.id});
    const fixture = libraryFixture();
    const enumerate = vi.spyOn(fixture.api.services, 'list');
    vi.spyOn(fixture.api.services, 'get').mockResolvedValue(pastDocument);
    const edit = vi.spyOn(fixture.api.content, 'edit').mockResolvedValue({
      ok: true,
      value: {id: pastDocument.service.id, revision: 4},
    });
    const {user, onOpenSong} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '예배 순서에 추가'}));
    await waitFor(() =>
      expect(edit.mock.lastCall?.[0]).toMatchObject({
        type: 'service.update',
        baseRevision: pastDocument.revision,
        service: {
          ...pastDocument.service,
          order: [
            ...pastDocument.service.order,
            {song: fixtureSong(1, '찬송 10').song.id},
          ],
        },
      }),
    );
    expect(onOpenSong).not.toHaveBeenCalled();
    expect(enumerate).not.toHaveBeenCalled();
  });

  it.each([
    {readOnly: false, reason: '열린 예배 없음'},
    {readOnly: true, reason: '새 버전의 파일이라 바꿀 수 없습니다'},
  ])('disables adding a library song: $reason', async ({readOnly, reason}) => {
    if (readOnly) applyService({...sampleService, readOnly: true});
    const fixture = libraryFixture();
    const edit = vi.spyOn(fixture.api.content, 'edit');
    const {user} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    const add = screen.getByRole('menuitem', {name: '예배 순서에 추가'});
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(add.hasAttribute('aria-haspopup')).toBe(false);
    await user.click(add);
    expect(edit).not.toHaveBeenCalled();
    expect((await hoverForTooltip(add))?.textContent).toBe(reason);
  });

  it('reports a failed append without changing the open editor', async () => {
    applyService({...sampleService, id: pastDocument.service.id});
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.services, 'get').mockRejectedValue(
      new Error('Read failed'),
    );
    const {user, onProblem, onOpenSong} = await setup(fixture);
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '예배 순서에 추가'}));
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'library:append',
          title: '예배 순서에 추가 실패',
        }),
      ),
    );
    expect(onOpenSong).not.toHaveBeenCalled();
  });

  it('starts ArrowDown at the first row when nothing is selected', async () => {
    const {onOpenSong} = await setup();
    fireEvent.keyDown(screen.getByRole('listbox', {name: '라이브러리 곡'}), {
      key: 'ArrowDown',
    });
    const first = screen.getByRole('option', {name: '만복의 근원 하나님'});
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(first);
    await waitFor(() =>
      expect(onOpenSong).toHaveBeenCalledWith({
        document: fixtureSong(2, '만복의 근원 하나님'),
        focusTitle: false,
      }),
    );
  });

  it('copies the clicked song under the copy title, selects the copy, and keeps the original', async () => {
    const {user} = await setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '복제'}));
    const copy = await screen.findByRole('option', {name: '찬송 10 복사본'});
    await waitFor(() =>
      expect(copy.getAttribute('aria-selected')).toBe('true'),
    );
    expect(screen.getByRole('option', {name: '찬송 10'})).toBeTruthy();
  });

  it('copies the focused song with Ctrl D', async () => {
    await setup();
    const song = screen.getByRole('option', {name: '찬송 10'});
    act(() => song.focus());
    fireEvent.keyDown(song, {key: 'd', code: 'KeyD', ctrlKey: true});
    expect(
      await screen.findByRole('option', {name: '찬송 10 복사본'}),
    ).toBeTruthy();
  });

  it('hands deletion failures to the host without a reload action', async () => {
    const {fixture, user, onProblem} = await setup();
    vi.spyOn(fixture.api.content, 'edit').mockRejectedValue(
      new Error('Delete failed'),
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    expect(onProblem.mock.lastCall?.[0]).toMatchObject({
      key: 'library:delete',
      title: '곡 삭제 실패',
    });
    expect(onProblem.mock.lastCall?.[0]?.actions).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('hands a failed load and its retry action to the host without mounting a stack', async () => {
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.songs, 'list').mockRejectedValueOnce(
      new Error('Read failed'),
    );
    const onProblem = vi.fn<(notice: Notice) => void>();
    render(
      <LibraryPanel
        api={fixture.api}
        onOpenSong={() => undefined}
        onProblem={onProblem}
      />,
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalledTimes(1));
    const notice = onProblem.mock.lastCall?.[0];
    expect(notice).toMatchObject({
      key: 'library:load',
      title: '라이브러리 불러오기 실패',
    });
    expect(screen.queryByRole('alert')).toBeNull();
    const action = notice?.actions?.[0];
    if (!action) throw new Error('Missing host retry action');
    expect(action.label).toBe('다시 불러오기');
    act(() => action.onSelect());
    await screen.findByRole('option', {name: '찬송 10'});
    expect(onProblem).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate creation while an edit is pending and reports its failure', async () => {
    const fixture = libraryFixture();
    let reject: (error: Error) => void = () => undefined;
    const edit = vi.spyOn(fixture.api.content, 'edit').mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const {user, onOpenSong, onProblem} = await setup(fixture);
    const create = screen.getByRole('button', {name: '새 곡'});
    await user.click(create);
    await user.click(create);
    expect(edit).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('Create failed')));
    expect(onProblem.mock.lastCall?.[0]).toMatchObject({
      key: 'library:create',
      title: '새 곡 만들기 실패',
    });
    expect(onProblem.mock.lastCall?.[0]?.actions).toBeUndefined();
    expect(create.getAttribute('aria-disabled')).not.toBe('true');
    expect(onOpenSong).not.toHaveBeenCalled();
  });
});
