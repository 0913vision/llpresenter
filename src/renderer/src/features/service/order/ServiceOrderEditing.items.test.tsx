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
} from './testing/serviceOrderEditingFixtures';

describe('service panel editing', () => {
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
      await screen.findByRole('menuitem', {name: '곡 편집'}),
    );
    expect(onOpenPrep).toHaveBeenCalledWith(lastId);
    expect(send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBeNull();
  });

  it('lists the rows of the ProPresenter playlist item menu for a song', async () => {
    setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const menu = await screen.findByRole('menu', {name: '예배 순서 항목 메뉴'});
    const rows = [
      ...menu.querySelectorAll('[role="menuitem"], [role="separator"]'),
    ].map(row =>
      row.getAttribute('role') === 'separator'
        ? '|'
        : (row.querySelector('[class*="label"]')?.textContent ?? ''),
    );
    expect(rows).toEqual([
      '항목 숨기기',
      '|',
      '구성',
      '출력 대상',
      '|',
      '곡 편집',
      '|',
      '복사',
      '붙여넣기',
      '복제',
      '삭제',
      '|',
      '라이브러리에서 보기',
      '묶음으로 내보내기…',
      '그림으로 내보내기…',
    ]);
    for (const name of ['구성', '라이브러리에서 보기']) {
      await waitFor(() =>
        expect(
          screen.getByRole('menuitem', {name}).getAttribute('aria-disabled'),
        ).not.toBe('true'),
      );
    }
  });

  it('checks the item arrangement and changes only the clicked item through the setting writer', async () => {
    const fixture = setup('show', false, {
      namedArrangement: true,
      arrangement: '짧은 구성',
    });
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const parent = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(parent.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.hover(parent);
    expect(
      (
        await screen.findByRole('menuitemradio', {name: '짧은 구성'})
      ).getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(screen.getByRole('menuitemradio', {name: '기본'}));
    await waitFor(() =>
      expect(fixture.document().service.order[2]).not.toHaveProperty(
        'arrangement',
      ),
    );
    expect(fixture.document().service.order[1]).toHaveProperty(
      'arrangement',
      '짧은 구성',
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: '다음 곡'}));
    const next = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(next.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.hover(next);
    expect(
      (await screen.findByRole('menuitemradio', {name: '기본'})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    await user.click(screen.getByRole('menuitemradio', {name: '짧은 구성'}));
    await waitFor(() =>
      expect(fixture.document().service.order[2]).toHaveProperty(
        'arrangement',
        '짧은 구성',
      ),
    );
    expect(fixture.send).not.toHaveBeenCalled();
    expect(useShow.getState().openItemId).toBeNull();
  });

  it('keeps a single default arrangement selectable without writing an unchanged item', async () => {
    const {api, send} = setup();
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    const parent = await screen.findByRole('menuitem', {name: '구성'});
    await waitFor(() =>
      expect(parent.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.hover(parent);
    const only = await screen.findByRole('menuitemradio', {name: '기본'});
    expect(screen.getAllByRole('menuitemradio')).toEqual([only]);
    expect(only.getAttribute('aria-checked')).toBe('true');
    await user.click(only);
    expect(api.content.edit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('disables both new rows when the song is missing', async () => {
    const {send, onShowInLibrary} = setup('show', false, {missingSong: true});
    await act(async () => {
      fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    });
    await userEvent.hover(screen.getByRole('menuitem', {name: '구성'}));
    expect(await screen.findByRole('tooltip')).toHaveProperty(
      'textContent',
      '곡 파일을 찾을 수 없습니다.',
    );
    for (const name of ['구성', '라이브러리에서 보기']) {
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
          .getByRole('menuitem', {name: '구성'})
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
