import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {ServiceOrderList} from './ServiceOrderList';
import {
  headerId,
  firstId,
  lastId,
  emptySectionId,
  songId,
  setup,
  transfer,
} from './testing/serviceOrderEditingFixtures';

describe('service panel editing', () => {
  it.each([{key: 'ContextMenu'}, {key: 'F10', shiftKey: true}])(
    'marks the focused order row when $key opens its menu',
    keys => {
      setup();
      const row = screen.getByRole('option', {name: '첫 곡'});
      row.focus();
      fireEvent.keyDown(row, keys);
      expect(
        screen.getByRole('menu', {name: '예배 순서 항목 메뉴'}),
      ).toBeDefined();
      expect(row.hasAttribute('data-menu-target')).toBe(true);
      fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
      expect(row.hasAttribute('data-menu-target')).toBe(false);
    },
  );

  it('hands focus from a selected section context menu to its rename field', async () => {
    const {api} = setup('prep');
    const user = userEvent.setup();
    const section = screen.getByRole('option', {name: '제목'});
    await user.click(section);
    section.focus();
    expect(document.activeElement).toBe(section);
    const contextTarget = section;
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    await user.click(
      await screen.findByRole('menuitem', {name: '이름 바꾸기'}),
    );
    const field = await screen.findByRole('textbox', {name: '제목 이름'});
    await waitFor(() => expect(document.activeElement).toBe(field));
    await user.clear(field);
    await user.type(field, '바뀐 구역{Enter}');
    await screen.findByRole('option', {name: '바뀐 구역'});
    expect(api.content.edit).toHaveBeenCalledTimes(1);
  });

  it('selects an empty section and keeps it when a dropped song is added below it', async () => {
    const {ids, send} = setup('prep', false, {emptySection: true});
    const target = screen.getByRole('option', {name: '빈 구역'});
    fireEvent.click(target);
    expect(useShow.getState().openItemId).toBe(emptySectionId);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 100, 200, 40),
    );
    const dataTransfer = transfer(JSON.stringify({kind: 'song', songId}));
    fireEvent.dragOver(target, {dataTransfer, clientY: 130});
    const drop = new MouseEvent('drop', {bubbles: true, clientY: 130});
    Object.defineProperty(drop, 'dataTransfer', {value: dataTransfer});
    fireEvent(target, drop);
    await waitFor(() => expect(ids()).toHaveLength(5));
    expect(ids().slice(0, 4)).toEqual([
      headerId,
      firstId,
      lastId,
      emptySectionId,
    ]);
    expect(
      screen.getByRole('option', {name: '빈 구역', selected: true}),
    ).toBeDefined();
    expect(useShow.getState().openItemId).toBe(emptySectionId);
    expect(send).not.toHaveBeenCalled();
  });

  it('shows the chosen arrangement count in prep and refreshes it with the projection', () => {
    const {view, onProblem} = setup('prep');
    expect(screen.getAllByText('슬라이드 0개')).toHaveLength(2);
    act(() =>
      useShow.setState({
        tiles: {
          [firstId]: [
            {label: null, labelColor: 'none', lines: ['Invented words']},
            {
              label: null,
              labelColor: 'none',
              lines: ['Repeated arrangement slide'],
            },
          ],
        },
      }),
    );
    expect(screen.getByText('슬라이드 2개')).toBeDefined();
    view.rerender(<ServiceOrderList workspace="show" onProblem={onProblem} />);
    expect(screen.queryByText('슬라이드 2개')).toBeNull();
  });

  it.each(['show', 'prep'] as const)(
    'deletes and undoes in %s without touching live output',
    async workspace => {
      const {api, send, list, ids} = setup(workspace);
      const user = userEvent.setup();
      const base = emptyLiveState();
      act(() =>
        useLive.setState({
          state: {
            ...base,
            layers: {
              ...base.layers,
              slide: {
                itemId: firstId,
                position: 0,
                label: null,
                lines: ['Kept live'],
              },
            },
          },
        }),
      );
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
      await user.click(await screen.findByRole('menuitem', {name: '삭제'}));
      await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
      fireEvent.keyDown(list(), {key: 'ㅋ', code: 'KeyZ', ctrlKey: true});
      await screen.findByRole('option', {name: '첫 곡'});
      fireEvent.keyDown(list(), {key: 'ㅛ', code: 'KeyY', ctrlKey: true});
      await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
      expect(api.content.edit).toHaveBeenCalledTimes(3);
      expect(useLive.getState().state?.layers.slide?.lines).toEqual([
        'Kept live',
      ]);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('ignores a delayed song read after another item menu opens', async () => {
    const {api} = setup();
    const document = await api.songs.get(songId);
    let finish: (value: typeof document) => void = () => undefined;
    const read = vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const parent = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(parent.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await act(async () => {
      finish(document);
    });
    expect(parent.getAttribute('aria-disabled')).not.toBe('true');
    await userEvent.hover(parent);
    expect(
      await screen.findByRole('menuitemradio', {name: '기본'}),
    ).toBeDefined();
  });

  it('keeps edit history when the list remounts for another workspace', async () => {
    const {view, ids, list} = setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    view.unmount();
    render(<ServiceOrderList workspace="prep" />);
    fireEvent.keyDown(list(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    await screen.findByRole('option', {name: '첫 곡'});
  });

  it('reorders songs and headers, using the list tail to append', async () => {
    const {api, send, list, ids} = setup();
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole('option', {name: '다음 곡'}), {
      dataTransfer,
    });
    fireEvent.dragOver(screen.getByText('제목'), {dataTransfer});
    expect(dataTransfer.dropEffect).toBe('move');
    fireEvent.drop(screen.getByText('제목'), {dataTransfer});
    await waitFor(() => expect(ids()).toEqual([lastId, headerId, firstId]));
    fireEvent.dragStart(screen.getByText('제목'), {dataTransfer});
    fireEvent.drop(list(), {dataTransfer});
    await waitFor(() => expect(ids()).toEqual([lastId, headerId, firstId]));
    expect(api.content.edit).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('drops above the first row from the list top padding', async () => {
    const {list, ids} = setup();
    const header = screen.getByRole('option', {name: '제목'});
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 4, 200, 30),
    );
    for (const [index, row] of screen.getAllByRole('option').entries()) {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 34 + index * 30, 200, 30),
      );
    }
    const dataTransfer = transfer();
    fireEvent.dragStart(screen.getByRole('option', {name: '다음 곡'}), {
      dataTransfer,
    });
    const event = new Event('drop', {bubbles: true, cancelable: true});
    Object.defineProperties(event, {
      dataTransfer: {value: dataTransfer},
      clientY: {value: 2},
    });
    fireEvent(list(), event);
    await waitFor(() => expect(ids()).toEqual([lastId, headerId, firstId]));
  });

  it('does not select or output a row on the click after a native drag', () => {
    const {send} = setup();
    const before = useShow.getState().openItemId;
    const row = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.dragStart(row, {dataTransfer: transfer()});
    fireEvent.dragEnd(row);
    fireEvent.click(row, {detail: 1});
    expect(useShow.getState().openItemId).toBe(before);
    expect(send).not.toHaveBeenCalled();
    fireEvent.pointerDown(row);
    fireEvent.click(row, {detail: 1});
    expect(useShow.getState().openItemId).toBe(lastId);
  });

  it('does not rename a dragged header on a release double click', () => {
    setup('prep');
    const header = screen.getByText('제목');
    fireEvent.dragStart(header, {dataTransfer: transfer()});
    fireEvent.dragEnd(header);
    fireEvent.doubleClick(header, {detail: 2});
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.pointerDown(header);
    fireEvent.doubleClick(header, {detail: 2});
    expect(screen.getByRole('textbox', {name: '제목 이름'})).toBeDefined();
  });
});
