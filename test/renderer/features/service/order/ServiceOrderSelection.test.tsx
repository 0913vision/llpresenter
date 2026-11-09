import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {useShow} from '@renderer/session/show';
import {
  setup,
  firstId,
  lastId,
  headerId,
  transfer,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';

describe.each(['show', 'prep'] as const)('%s service selection', workspace => {
  it('moves the selected items with Alt arrows in one undo step', async () => {
    const {ids, list} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    last.focus();
    fireEvent.keyDown(last, {key: 'ArrowUp', code: 'ArrowUp', altKey: true});
    await waitFor(() => expect(ids()).toEqual([firstId, lastId, headerId]));
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
  });
  it('moves a focused item down with Alt Down', async () => {
    const {ids} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.click(first);
    first.focus();
    fireEvent.keyDown(first, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      altKey: true,
    });
    await waitFor(() => expect(ids()).toEqual([headerId, lastId, firstId]));
  });
  it('disables a menu move at the end with its reason', async () => {
    setup(workspace);
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.contextMenu(last);
    expect(
      screen
        .getByRole('menuitem', {name: /아래로 옮기기/})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });
  it('moves selected rows together from the menu and undoes in one step', async () => {
    const {ids, list} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    await userEvent.click(screen.getByRole('menuitem', {name: /위로 옮기기/}));
    await waitFor(() => expect(ids()).toEqual([firstId, lastId, headerId]));
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
  });
  it('reports a stale confirmation through the host notification channel', async () => {
    const {ids, onProblem} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    await userEvent.click(screen.getByRole('menuitem', {name: '2개 삭제'}));
    expect(screen.getByRole('alertdialog')).toBeDefined();
    act(() => useShow.setState(state => ({rows: [...state.rows]})));
    await userEvent.click(screen.getByRole('button', {name: '삭제'}));
    expect(ids()).toEqual([headerId, firstId, lastId]);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        key: 'selection-delete:stale',
        kind: 'info',
        title: '항목이 변경되어 삭제하지 않았습니다',
      }),
    );
    expect(
      screen.queryByRole('status', {
        name: '항목이 변경되어 삭제하지 않았습니다',
      }),
    ).toBeNull();
  });
  it('keeps the selected set for its menu, confirms once, and restores all with one undo', async () => {
    const {ids, api, send, list} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    expect(screen.getAllByRole('option', {selected: true})).toHaveLength(2);
    expect(screen.queryByRole('menuitem', {name: '곡 편집'})).toBeNull();
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '2개 삭제'}),
    );
    expect(
      screen.getByRole('alertdialog', {name: '2개를 삭제할까요?'}),
    ).toBeDefined();
    expect(api.content.edit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: '삭제'}));
    await waitFor(() => expect(ids()).toEqual([headerId]));
    expect(api.content.edit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
    expect(send).not.toHaveBeenCalled();
  });
  it('duplicates the selected rows together and moves them with a counted drag image', async () => {
    const {ids, list} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '2개 복제'}),
    );
    await waitFor(() => expect(ids()).toHaveLength(5));
    expect(ids().slice(0, 3)).toEqual([headerId, firstId, lastId]);
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(ids()).toHaveLength(3));
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    const dataTransfer = transfer();
    fireEvent.dragStart(first, {dataTransfer});
    expect(document.querySelector('.selection-drag__count')?.textContent).toBe(
      '2',
    );
    fireEvent.drop(screen.getByText('제목'), {dataTransfer});
    await waitFor(() => expect(ids()).toEqual([firstId, lastId, headerId]));
    expect(document.querySelector('.selection-drag')).toBeNull();
  });
  it('selects an unselected context target and deletes it immediately', async () => {
    const {ids} = setup(workspace);
    fireEvent.click(screen.getByRole('option', {name: '첫 곡'}));
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.contextMenu(last);
    expect(screen.getAllByRole('option', {selected: true})).toEqual([last]);
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(ids()).toEqual([headerId, firstId]));
  });
});
