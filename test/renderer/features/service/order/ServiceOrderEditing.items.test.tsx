import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {
  headerId,
  firstId,
  lastId,
  songId,
  setup,
  transfer,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';
import {useShow} from '@renderer/session/show/showStore';
import {usePrepTarget} from '@renderer/session/prepTarget';
import {undoTimeline} from '@renderer/platform/undo/undoTimeline';
import {isItemOfKind} from '@core/schema/services/service';
import {
  closeSongDraft,
  replaySong,
  useSongDraft,
} from '@renderer/features/songs/draft';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

describe('service panel editing', () => {
  it('drops a song without a row target immediately after the selected item', async () => {
    const {ids, send} = setup('prep');
    fireEvent.click(screen.getByRole('option', {name: '첫 곡'}));
    const list = screen.getByRole('listbox', {name: '예배 순서'});
    const dataTransfer = transfer(JSON.stringify({kind: 'song', songId}));
    fireEvent.drop(list, {dataTransfer});
    await waitFor(() => expect(ids()).toHaveLength(4));
    expect(ids()[1]).toBe(firstId);
    expect(ids()[3]).toBe(lastId);
    await waitFor(() => expect(useShow.getState().openItemId).toBe(ids()[2]));
    expect(send).not.toHaveBeenCalled();
  });

  it('copies validated library song drops and ignores unrelated or malformed data', async () => {
    const {api, send, ids} = setup('prep');
    const target = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.drop(target, {dataTransfer: transfer('not json')});
    fireEvent.drop(target, {dataTransfer: transfer()});
    expect(api.content.edit).not.toHaveBeenCalled();
    const dataTransfer = transfer(JSON.stringify({kind: 'song', songId}));
    fireEvent.dragOver(target, {dataTransfer});
    expect(dataTransfer.dropEffect).toBe('copy');
    fireEvent.drop(target, {dataTransfer});
    await waitFor(() => expect(ids()).toHaveLength(4));
    expect(ids()[1]).not.toBe(firstId);
    expect(send).not.toHaveBeenCalled();
  });

  it('copies an item from its menu and with Ctrl D, opens the copy, and undoes each as one step', async () => {
    const {ids} = setup('prep');
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '복제'}));
    await waitFor(() => expect(ids()).toHaveLength(4));
    expect(ids()[2]).not.toBe(firstId);
    expect(ids().slice(0, 2)).toEqual([headerId, firstId]);
    expect(useShow.getState().openItemId).toBe(ids()[2]);
    const copy = screen.getAllByRole('option', {name: '첫 곡'})[0];
    if (copy === undefined) throw new Error('Missing row');
    await userEvent.click(copy);
    fireEvent.keyDown(copy, {key: 'd', code: 'KeyD', ctrlKey: true});
    await waitFor(() => expect(ids()).toHaveLength(5));
    await userEvent.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(ids()).toHaveLength(4));
    await userEvent.click(
      screen.getAllByRole('option', {name: '첫 곡'})[0] ?? copy,
    );
    await userEvent.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
  });

  it('copies a whole 구역 with its items from its menu', async () => {
    const {ids} = setup('prep');
    fireEvent.contextMenu(screen.getByRole('option', {name: '제목'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '3개 복제'}),
    );
    await waitFor(() => expect(ids()).toHaveLength(6));
    expect(ids().slice(0, 3)).toEqual([headerId, firstId, lastId]);
  });

  it('disables read-only deletion and drops', async () => {
    const {api} = setup('prep', true);
    const target = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.contextMenu(target);
    expect(
      (await screen.findByRole('menuitem', {name: '삭제'})).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
    fireEvent.drop(target, {
      dataTransfer: transfer(JSON.stringify({kind: 'song', songId})),
    });
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it('opens the song in the song editor with the item’s lyrics, its title slides left out, and writes nothing', async () => {
    const opening = {
      ...slideOf(5, 'songTitle', {texts: {제목: '첫 곡'}}),
      label: '전주',
    };
    const verse = lyricsSlide(6, '항목에서 고친 가사');
    const closing = {
      ...slideOf(7, 'songTitle', {texts: {제목: '첫 곡'}}),
      label: '후주',
    };
    const {api} = setup('prep', false, {
      firstItem: {
        id: firstId,
        kind: 'song',
        name: '첫 곡',
        song: songId,
        slides: [opening, verse, closing],
      },
    });
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '라이브러리에 저장…'}),
    );

    await waitFor(() =>
      expect(useSongDraft.getState().draft?.song.slides).toEqual([verse]),
    );
    expect(useSongDraft.getState().draft?.document?.song.id).toBe(songId);
    expect(usePrepTarget.getState().target).toEqual({kind: 'song'});
    expect(api.content.edit).not.toHaveBeenCalled();
    act(() => {
      replaySong('undo');
    });
    expect(useSongDraft.getState().draft?.song.slides).toEqual([
      lyricsSlide(1, ''),
    ]);
    act(() => closeSongDraft());
  });

  it('reloads an item from the library as an order edit that 실행 취소 runs back', async () => {
    const {api} = setup('prep');
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: '라이브러리에서 다시 불러오기',
      }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(
      within(dialog).getByRole('button', {name: '다시 불러오기'}),
    );

    await waitFor(() => expect(api.content.edit).toHaveBeenCalledOnce());
    const command = vi.mocked(api.content.edit).mock.calls[0]?.[0];
    const item =
      command?.type === 'service.update'
        ? command.service.order.find(row => row.id === firstId)
        : undefined;
    const labels =
      item !== undefined && isItemOfKind(item, 'song')
        ? item.slides.map(slide => slide.label ?? '')
        : [];
    expect(labels).toEqual(['전주', '', '후주']);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    expect(await undoTimeline.replay('undo', vi.fn())).toBe(true);
    await waitFor(() => expect(api.content.edit).toHaveBeenCalledTimes(2));
  });

  it('disables both new rows when the song is missing', async () => {
    const {send, onShowInLibrary} = setup('prep', false, {missingSong: true});
    await act(async () => {
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    });
    await userEvent.hover(
      screen.getByRole('menuitem', {name: '라이브러리에 저장…'}),
    );
    expect(await screen.findByRole('tooltip')).toHaveProperty(
      'textContent',
      '곡 파일을 찾을 수 없습니다.',
    );
    for (const name of [
      '라이브러리에 저장…',
      '라이브러리에서 다시 불러오기',
      '라이브러리에서 보기',
    ]) {
      expect(
        screen.getByRole('menuitem', {name}).getAttribute('aria-disabled'),
      ).toBe('true');
    }
    expect(onShowInLibrary).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes the selected prep item with Delete and keeps focus for Ctrl Z', async () => {
    const {ids, send} = setup('prep');
    const user = userEvent.setup();
    const row = screen.getByRole('option', {name: '첫 곡'});
    const next = screen.getByRole('option', {name: '다음 곡'});
    const focusNext = vi.spyOn(next, 'focus');
    await user.click(row);
    row.focus();
    await user.keyboard('{Delete}');
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '다음 곡'}),
    );
    expect(useShow.getState().openItemId).toBe(lastId);
    expect(focusNext).toHaveBeenCalledWith({preventScroll: true});
    await user.keyboard('{Delete}');
    await waitFor(() => expect(ids()).toEqual([headerId]));
    await user.keyboard('{Control>}z{/Control}');
    await screen.findByRole('option', {name: '다음 곡'});
    expect(send).not.toHaveBeenCalled();
  });

  it('takes a second Delete pressed while the first is still being saved', async () => {
    const {api, ids, onProblem} = setup('prep');
    const save = vi.mocked(api.content.edit);
    const saveNow = save.getMockImplementation();
    if (saveNow === undefined) throw new Error('Missing save');
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    save.mockImplementation(async command => {
      await held;
      return saveNow(command);
    });
    const user = userEvent.setup();
    const row = screen.getByRole('option', {name: '첫 곡'});
    await user.click(row);
    row.focus();
    await user.keyboard('{Delete}');
    await user.keyboard('{Delete}');
    release();
    await waitFor(() => expect(ids()).toEqual([headerId]));
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('deletes from the menu and hands focus to the next row without scrolling', async () => {
    const {ids} = setup('prep');
    const user = userEvent.setup();
    const row = screen.getByRole('option', {name: '첫 곡'});
    await user.click(row);
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    const next = screen.getByRole('option', {name: '다음 곡'});
    await waitFor(() => expect(document.activeElement).toBe(next));
    expect(useShow.getState().openItemId).toBe(lastId);
    await user.keyboard('{Delete}');
    await waitFor(() => expect(ids()).toEqual([headerId]));
  });
});
