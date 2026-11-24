import {act, fireEvent, screen, waitFor} from '@testing-library/react';
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
