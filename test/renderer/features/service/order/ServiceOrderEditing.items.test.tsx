import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {useShow} from '@renderer/session/show';
import {
  headerId,
  firstId,
  lastId,
  songId,
  setup,
  transfer,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';

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
    const {api} = setup('show', true);
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

  it('hands failures to the host and leaves the visible projection unchanged', async () => {
    const {api, onProblem, ids} = setup();
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({key: 'service-order:stale'}),
      ),
    );
    expect(ids()).toEqual([headerId, firstId, lastId]);
  });

  it('opens a song in prep through the host, without output', async () => {
    const {onOpenPrep, send} = setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: windowCommandLabels.editSong}),
    );
    expect(onOpenPrep).toHaveBeenCalledWith(lastId);
    expect(send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBe(lastId);
  });

  it('disables both new rows when the song is missing', async () => {
    const {send, onShowInLibrary} = setup('show', false, {missingSong: true});
    await act(async () => {
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    });
    await userEvent.hover(
      screen.getByRole('menuitem', {name: '라이브러리에 저장…'}),
    );
    expect(await screen.findByRole('tooltip')).toHaveProperty(
      'textContent',
      '곡 파일을 찾을 수 없습니다',
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

  it.each(['show', 'prep'] as const)(
    'reveals the song from %s even when its service is read-only',
    async workspace => {
      const {api, send, onShowInLibrary} = setup(workspace, true);
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
      const reveal = await screen.findByRole('menuitem', {
        name: '라이브러리에서 보기',
      });
      await waitFor(() =>
        expect(reveal.getAttribute('aria-disabled')).not.toBe('true'),
      );
      expect(
        screen
          .getByRole('menuitem', {name: '라이브러리에 저장…'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
      await userEvent.click(reveal);
      expect(onShowInLibrary).toHaveBeenCalledExactlyOnceWith(songId);
      expect(api.content.edit).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('deletes the selected prep item with Delete and keeps focus for Ctrl Z', async () => {
    const {ids, send} = setup('prep');
    const user = userEvent.setup();
    const row = screen.getByRole('option', {name: '첫 곡'});
    await user.click(row);
    row.focus();
    await user.keyboard('{Delete}');
    await waitFor(() => expect(ids()).toEqual([headerId, lastId]));
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '제목'}),
    );
    await user.keyboard('{Control>}z{/Control}');
    await screen.findByRole('option', {name: '첫 곡'});
    expect(send).not.toHaveBeenCalled();
  });

  it('logs the cause of a local edit-dispatch failure and reports it to the host', async () => {
    const {api, onProblem} = setup();
    const log = vi.spyOn(api.log, 'write');
    act(() => useShow.setState({serviceId: 'invalid-id'}));
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(log.mock.calls[0]?.[0].message).toBe(
      'Could not edit the service order',
    );
    expect(log.mock.calls[0]?.[0].detail).toBeTruthy();
  });
});
