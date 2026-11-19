import {fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {powerpointImageItem} from '@core/services/powerpointImages';
import {
  setup,
  firstId,
  lastId,
  headerId,
  transfer,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';

it('does not reorder show items or sections by drag, shortcuts, or menu', () => {
  const {ids, api} = setup('show');
  const first = screen.getByRole('option', {name: '첫 곡'});
  const last = screen.getByRole('option', {name: '다음 곡'});
  const header = screen.getByText('제목');
  expect(first.closest('[data-order-id]')?.getAttribute('draggable')).toBe(
    'false',
  );
  expect(header.closest('[data-order-id]')?.getAttribute('draggable')).toBe(
    'false',
  );
  const dataTransfer = transfer();
  fireEvent.dragStart(first, {dataTransfer});
  fireEvent.drop(last, {dataTransfer});
  fireEvent.dragStart(header, {dataTransfer});
  fireEvent.drop(last, {dataTransfer});
  fireEvent.keyDown(last, {key: 'ArrowUp', code: 'ArrowUp', altKey: true});
  fireEvent.keyDown(first, {key: 'ArrowDown', code: 'ArrowDown', altKey: true});
  fireEvent.contextMenu(first);
  expect(
    screen.queryByRole('menuitem', {name: /위로 옮기기|아래로 옮기기/}),
  ).toBeNull();
  expect(screen.getByRole('menuitem', {name: '복제'})).toBeDefined();
  expect(ids()).toEqual([headerId, firstId, lastId]);
  expect(api.content.edit).not.toHaveBeenCalled();
});

describe.each(['show', 'prep'] as const)('%s service selection', workspace => {
  it('restores a deleted PowerPoint picture item and its media reference on undo', async () => {
    const mediaId = createMediaId('00000000-0000-4000-8000-000000000011');
    const item = {...powerpointImageItem('deck.pptx', [mediaId]), id: firstId};
    const {api, document, list} = setup(workspace, false, {firstItem: item});
    const mediaEdit = vi.spyOn(api.media, 'edit');
    const first = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.contextMenu(first);
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() =>
      expect(document().service.order).not.toContainEqual(item),
    );
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await waitFor(() => expect(document().service.order).toContainEqual(item));
    expect(mediaEdit).not.toHaveBeenCalled();
  });
  it.skipIf(workspace === 'show')(
    'moves the selected items with Alt arrows in one undo step',
    async () => {
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
    },
  );
  it.skipIf(workspace === 'show')(
    'moves a focused item down with Alt Down',
    async () => {
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
    },
  );
  it.skipIf(workspace === 'show')(
    'disables a menu move at the end with its reason',
    async () => {
      setup(workspace);
      const last = screen.getByRole('option', {name: '다음 곡'});
      fireEvent.contextMenu(last);
      expect(
        screen
          .getByRole('menuitem', {name: /아래로 옮기기/})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    },
  );
  it.skipIf(workspace === 'show')(
    'moves selected rows together from the menu and undoes in one step',
    async () => {
      const {ids, list} = setup(workspace);
      const first = screen.getByRole('option', {name: '첫 곡'});
      const last = screen.getByRole('option', {name: '다음 곡'});
      fireEvent.click(first);
      fireEvent.click(last, {ctrlKey: true});
      fireEvent.contextMenu(first);
      expect(first.hasAttribute('data-menu-target')).toBe(true);
      expect(last.hasAttribute('data-menu-target')).toBe(true);
      expect(list().hasAttribute('data-menu-target')).toBe(false);
      await userEvent.click(
        screen.getByRole('menuitem', {name: /위로 옮기기/}),
      );
      await waitFor(() => expect(ids()).toEqual([firstId, lastId, headerId]));
      fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
      await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
    },
  );
  it('deletes selected rows immediately without a notice', async () => {
    const {ids, onProblem} = setup(workspace);
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    await userEvent.click(screen.getByRole('menuitem', {name: '2개 삭제'}));
    await waitFor(() => expect(ids()).toEqual([headerId]));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onProblem).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('status', {
        name: '항목이 변경되어 삭제하지 않았습니다',
      }),
    ).toBeNull();
  });
  it('deletes the selected set from its menu and restores all with one undo', async () => {
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
    expect(screen.queryByRole('alertdialog')).toBeNull();
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
    if (workspace === 'show') return;
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
