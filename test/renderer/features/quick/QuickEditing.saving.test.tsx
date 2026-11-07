import {lastLiveCommand} from '@fixtures/renderer/session/liveCommands';
import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {createQuickItemId} from '@core/schema/ids';
import {isKnownQuickItem} from '@core/schema/quick';
import {useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {openLibrarySong} from '@renderer/session/showLibrary';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {openBiblePassage} from '@renderer/features/bible/actions';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {
  MAX_QUICK_ITEMS,
  newQuickItem,
  saveQuickEdit,
} from '@renderer/features/quick/quickEdits';
import {useQuickEditing} from '@renderer/features/quick/useQuickEditing';
import {quickRunner} from '@renderer/features/quick/quickActions';
import {
  deferred,
  quickDocument,
  quickId,
  quickItem,
} from '@fixtures/renderer/features/tools/quickTesting';
import {
  setup,
  failPersistedEdit,
  openAddMenu,
} from '@fixtures/renderer/features/quick/quickEditingFixtures';

describe('quick editing', () => {
  it('retains an applied rename draft and its disk warning until saving succeeds', async () => {
    const fixture = setup();
    failPersistedEdit(fixture.edit);
    fixture.mount();
    fireEvent.contextMenu(
      await screen.findByRole('button', {name: '저장된 곡'}),
    );
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: '적용된 이름'},
    });
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() =>
      expect(
        screen
          .getByRole('textbox', {name: '이름'})
          .getAttribute('aria-invalid'),
      ).toBe('true'),
    );
    expect(screen.getByDisplayValue('적용된 이름')).toBeDefined();
    expect(fixture.current().value.items[0]?.name).toBe('적용된 이름');
    expect(fixture.problem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({kind: 'warning', title: '퀵 실행 저장 실패'}),
    );
    expect(fixture.edit).toHaveBeenCalledOnce();
  });
  it('accepts an applied addition without retrying and lets close proceed', async () => {
    const fixture = setup();
    failPersistedEdit(fixture.edit);
    const {result} = renderHook(() =>
      useQuickEditing(fixture.api, fixture.problem),
    );
    let accepted = false;
    await act(async () => {
      const adding = result.current.run({
        kind: 'add',
        item: newQuickItem({kind: 'black', name: '검은 화면'}),
      });
      const flushing = pendingWritesOf(fixture.api).flush();
      accepted = await adding;
      expect(await flushing).toBe(true);
    });
    expect(accepted).toBe(true);
    expect(fixture.current().value.items).toHaveLength(8);
    expect(fixture.edit).toHaveBeenCalledOnce();
    expect(fixture.problem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({kind: 'warning', title: '퀵 실행 저장 실패'}),
    );
  });
  it.each(['song', 'bible'] as const)(
    'copies the current service %s reference',
    async kind => {
      const fixture = setup();
      const bible = quickItem('bible');
      if (bible.kind !== 'bible') throw new Error('Missing Bible fixture');
      const parsed = parseServiceDocument({
        revision: 1,
        access: 'editable',
        service: {
          format: 'llservice',
          schemaVersion: 1,
          id: quickId(900),
          name: '테스트 예배',
          date: '2026-10-26T09:00',
          order: [
            kind === 'song'
              ? {id: quickId(901), song: fixture.song.songId}
              : {id: quickId(901), bible: bible.ref},
          ],
        },
      });
      if (!parsed.ok || parsed.value === null) {
        throw new Error('Invalid service fixture');
      }
      vi.spyOn(fixture.api.services, 'get').mockResolvedValue(parsed.value);
      useShow.setState({
        serviceId: quickId(900),
        openItemId: quickId(901),
        rows: [{id: quickId(901), kind, title: '예배 항목'}],
      });
      fixture.mount();
      await openAddMenu();
      const current = await screen.findByRole('menuitem', {
        name: /현재 항목 추가/,
      });
      await waitFor(() =>
        expect(current.getAttribute('aria-disabled')).not.toBe('true'),
      );
      fireEvent.click(current);
      await waitFor(() =>
        expect(fixture.current().value.items.at(-1)).toMatchObject({
          kind,
          ref: kind === 'song' ? fixture.song.songId : bible.ref,
        }),
      );
      expect(fixture.send).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])(
    'copies and replays the open Bible preview with numbering %s',
    async verseNumbers => {
      const fixture = setup();
      openBiblePassage(panelPassage(), {verseNumbers});
      fixture.mount();
      await openAddMenu();
      const current = await screen.findByRole('menuitem', {
        name: /현재 항목 추가/,
      });
      await waitFor(() =>
        expect(current.getAttribute('aria-disabled')).not.toBe('true'),
      );
      fireEvent.click(current);
      await waitFor(() =>
        expect(fixture.current().value.items.at(-1)).toMatchObject({
          kind: 'bible',
          ref: {
            ref: panelPassage().ref,
            split: 'verse',
            reference: 'none',
            verseNumbers,
          },
        }),
      );
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.document().value.recents).toEqual([]);
      const stored = fixture.current().value.items.at(-1);
      if (!stored || !isKnownQuickItem(stored) || stored.kind !== 'bible') {
        throw new Error('Missing saved Bible item');
      }
      act(() =>
        openBiblePassage(panelPassage(), {verseNumbers: !verseNumbers}),
      );
      await act(async () =>
        quickRunner(fixture.api, fixture.problem).run(stored),
      );
      expect(
        lastLiveCommand(fixture.send.mock.calls.at(-1)?.[0]),
      ).toMatchObject({
        type: 'slide.show',
        slide: {
          position: 0,
          lines: [
            `${verseNumbers ? '16 ' : ''}Invented book 43, chapter 3, verse 16`,
          ],
        },
      });
      expect(fixture.problem).not.toHaveBeenCalled();
    },
  );
  it('adds the open library song and keeps its background out of the saved target', async () => {
    const fixture = setup();
    openLibrarySong(fixture.song);
    fixture.mount();
    await openAddMenu();
    const current = await screen.findByRole('menuitem', {
      name: /현재 항목 추가/,
    });
    await waitFor(() =>
      expect(current.getAttribute('aria-disabled')).not.toBe('true'),
    );
    fireEvent.click(current);
    await waitFor(() =>
      expect(fixture.current().value.items.at(-1)).toEqual({
        id: '00000000-0000-4000-8000-000000000999',
        kind: 'song',
        ref: fixture.song.songId,
        name: fixture.song.title,
      }),
    );
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('renames and deletes an unknown row without changing live output or its extra fields', async () => {
    const fixture = setup();
    fixture.mount();
    const live = useLive.getState().state;
    fireEvent.contextMenu(
      await screen.findByRole('button', {name: '새 버전 항목'}),
    );
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    const name = screen.getByRole('textbox', {name: '이름'});
    fireEvent.change(name, {target: {value: '  '}});
    expect(
      screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.change(name, {target: {value: '  새 이름  '}});
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    const row = await screen.findByRole('button', {name: '새 이름'});
    expect(fixture.current().value.items.at(-1)).toMatchObject({
      name: '새 이름',
      extension: true,
    });
    fireEvent.contextMenu(row);
    fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    const question = await screen.findByRole('alertdialog');
    expect(question.textContent).toContain(
      '‘새 이름’ 퀵 실행 항목을 삭제할까요?',
    );
    fireEvent.click(within(question).getByRole('button', {name: '취소'}));
    expect(screen.getByRole('button', {name: '새 이름'})).toBeDefined();
    fireEvent.contextMenu(row);
    fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: '새 이름'})).toBeNull(),
    );
    expect(useLive.getState().state).toBe(live);
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('retries once on a fresh revision and preserves concurrent changes', async () => {
    const fixture = setup();
    fixture.edit.mockImplementationOnce(() => {
      const fresh = quickDocument(2);
      fixture.push({
        ...fresh,
        value: {
          ...fresh.value,
          items: [
            ...fresh.value.items,
            {
              ...quickItem('black'),
              id: createQuickItemId(quickId(88)),
              name: '다른 변경',
            },
          ],
        },
      });
      return Promise.resolve({
        ok: false,
        error: {reason: 'stale', message: 'Invented stale edit'},
      });
    });
    await saveQuickEdit(fixture.api, {
      kind: 'rename',
      id: quickItem('song').id,
      name: '새 곡 이름',
    });
    expect(fixture.edit).toHaveBeenCalledTimes(2);
    expect(fixture.current().value.items.at(-1)?.name).toBe('다른 변경');
    expect(fixture.edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 2});
  });
  it('refuses read-only edits and additions at the list cap', async () => {
    const fixture = setup();
    fixture.get.mockResolvedValueOnce({...quickDocument(), access: 'readOnly'});
    await expect(
      saveQuickEdit(fixture.api, {kind: 'delete', id: quickItem('song').id}),
    ).rejects.toThrow();
    const full = quickDocument();
    fixture.push({
      ...full,
      value: {
        ...full.value,
        items: Array.from({length: MAX_QUICK_ITEMS}, (_, index) => ({
          ...quickItem('black'),
          id: createQuickItemId(quickId(index + 1)),
        })),
      },
    });
    await expect(
      saveQuickEdit(fixture.api, {
        kind: 'add',
        item: newQuickItem({kind: 'black', name: '검은 화면'}),
      }),
    ).rejects.toThrow();
    expect(fixture.edit).not.toHaveBeenCalled();
  });
  it('locks duplicate saves and leaves a failed rename open for correction', async () => {
    const fixture = setup();
    fixture.mount();
    const result = deferred<EditResult>();
    fixture.edit.mockReturnValueOnce(result.promise);
    fireEvent.contextMenu(
      await screen.findByRole('button', {name: '저장된 곡'}),
    );
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: '새 이름'},
    });
    const save = screen.getByRole('button', {name: '저장'});
    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });
    await waitFor(() => expect(fixture.edit).toHaveBeenCalledOnce());
    await act(async () =>
      result.resolve({
        ok: false,
        error: {reason: 'saves-full', message: 'Invented save refusal'},
      }),
    );
    expect(fixture.problem).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('dialog', {name: '퀵 실행 이름 바꾸기'}),
    ).toBeTruthy();
  });
});
