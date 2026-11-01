import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {hoverForTooltip} from '@renderer/ui/tooltipTesting';
import type {Notice} from '@renderer/ui/notices';
import {layerContainer} from '@renderer/ui/layers';
import {fixtureSong, libraryFixture} from './fixture';
import {LibraryPanel} from './LibraryPanel';
import {LibraryGalleryHost} from '../../../gallery/LibrarySection';
import {pastDocument} from '@core/testing/serviceList';
import {applyService} from '@renderer/session/show';
import {sampleService} from '@renderer/session/testing/sampleService';
import {setup} from './testing/libraryPanelFixtures';

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

  it('ignores extra modifiers and composition when opening a song menu', async () => {
    await setup();
    const opener = screen.getByRole('option', {name: '찬송 10'});
    for (const key of [
      {key: 'F10'},
      {key: 'F10', shiftKey: true, altKey: true},
      {key: 'ContextMenu', ctrlKey: true},
      {key: 'ContextMenu', metaKey: true},
      {key: 'ContextMenu', shiftKey: true},
      {key: 'ContextMenu', isComposing: true},
    ]) {
      fireEvent.keyDown(opener, key);
      expect(screen.queryByRole('menu')).toBeNull();
    }
  });

  it('lists the library song menu rows in ProPresenter order', async () => {
    await setup();
    const contextTarget = screen.getByRole('option', {name: '찬송 10'});
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    const menu = screen.getByRole('menu', {name: '곡 메뉴'});
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual([
      '예배 순서에 추가',
      '|',
      '구성',
      '출력 대상',
      '|',
      '곡 편집',
      '|',
      '복사',
      '붙여넣기',
      '복제',
      '이름 바꾸기',
      '삭제',
      '|',
      '탐색기에서 보기',
      '묶음으로 내보내기…',
      '그림으로 내보내기…',
    ]);
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')]
        .filter(row => row.getAttribute('aria-disabled') !== 'true')
        .map(row => row.textContent),
    ).toEqual(['곡 편집', '삭제']);
  });

  it('opens the right-clicked song in the preparation editor', async () => {
    const {onOpenSong, user} = await setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    expect(onOpenSong).not.toHaveBeenCalled();
    await user.click(screen.getByRole('menuitem', {name: '곡 편집'}));
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
    {readOnly: false, reason: '열린 예배 순서가 없습니다'},
    {readOnly: true, reason: '읽기 전용 예배 순서입니다'},
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

  it('lets its gallery host share, replace, and cap notices in one stack', async () => {
    const fixture = libraryFixture();
    vi.spyOn(fixture.api.songs, 'list').mockRejectedValueOnce(
      new Error('Read failed'),
    );
    render(<LibraryGalleryHost api={fixture.api} />);
    const user = userEvent.setup();
    await screen.findByText('라이브러리 불러오기 실패');
    await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
    await screen.findByRole('option', {name: '찬송 10'});
    expect(screen.queryByRole('alert')).toBeNull();
    vi.spyOn(fixture.api.songs, 'get').mockRejectedValue(
      new Error('Open failed'),
    );
    await user.click(screen.getByRole('option', {name: '찬송 10'}));
    await screen.findByText('곡 열기 실패');
    await user.click(screen.getByRole('option', {name: '찬송 2'}));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    vi.spyOn(fixture.api.library, 'search').mockRejectedValue(
      new Error('Search failed'),
    );
    const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
    fireEvent.change(input, {target: {value: 'x'}});
    await screen.findByText('라이브러리 검색 실패');
    fireEvent.keyDown(input, {key: 'Escape'});
    vi.spyOn(fixture.api.content, 'edit').mockRejectedValue(
      new Error('Edit failed'),
    );
    await user.click(screen.getByRole('button', {name: '새 곡'}));
    await screen.findByText('새 곡 만들기 실패');
    fireEvent.contextMenu(screen.getByRole('option', {name: '찬송 10'}));
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await screen.findByText('곡 삭제 실패');
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    expect(screen.queryByText('곡 열기 실패')).toBeNull();
    expect(screen.queryByRole('button', {name: '다시 불러오기'})).toBeNull();
    expect(layerContainer('notification').children).toHaveLength(1);
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
