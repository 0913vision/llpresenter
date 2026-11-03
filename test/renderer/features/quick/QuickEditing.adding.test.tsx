import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {useShow} from '@renderer/session/show';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {QuickRowEditor} from '@renderer/features/quick/QuickEditing';
import {renderedToolMenuRows} from '@fixtures/renderer/features/tools/toolMenuTesting';
import {saveQuickEdit} from '@renderer/features/quick/quickEdits';
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
  it('explains pending targets, empty lists and an unavailable current item', async () => {
    const fixture = setup();
    const original = fixture.get.getMockImplementation();
    if (!original) throw new Error('Missing settings fixture');
    const props = deferred<Awaited<ReturnType<LlpApi['settings']['get']>>>();
    const macros = deferred<Awaited<ReturnType<LlpApi['settings']['get']>>>();
    fixture.get.mockImplementation(request =>
      request.name === 'props'
        ? props.promise
        : request.name === 'macros'
          ? macros.promise
          : original(request),
    );
    const source = deferred<Awaited<ReturnType<LlpApi['services']['get']>>>();
    vi.spyOn(fixture.api.services, 'get').mockReturnValue(source.promise);
    useShow.setState({serviceId: quickId(1), openItemId: quickId(2)});
    fixture.mount();
    await openAddMenu();
    for (const [name, reason] of [
      ['그래픽', '그래픽 불러오는 중'],
      ['매크로', '매크로 불러오는 중'],
      ['현재 항목 추가', '현재 항목 불러오는 중'],
    ] as const) {
      expect(
        (await hoverForTooltip(screen.getByRole('menuitem', {name})))
          ?.textContent,
      ).toContain(reason);
      resetTooltips();
    }
    await act(async () => {
      props.resolve(settingsDocument('props', {props: []}));
      macros.resolve(settingsDocument('macros', {macros: [], collections: []}));
      source.resolve(null);
    });
    for (const [name, reason] of [
      ['그래픽', '그래픽 없음'],
      ['매크로', '매크로 없음'],
      ['현재 항목 추가', '추가할 현재 항목 없음'],
    ] as const) {
      expect(
        (await hoverForTooltip(screen.getByRole('menuitem', {name})))
          ?.textContent,
      ).toContain(reason);
      resetTooltips();
    }
  });

  it.each([false, true])(
    'opens the complete quick-item menu when locked=%s',
    async locked => {
      const save = vi.fn(async () => true);
      render(
        <QuickRowEditor
          full={false}
          timersFull={false}
          item={quickItem('black')}
          locked={locked}
          save={save}
        >
          <button>항목</button>
        </QuickRowEditor>,
      );
      fireEvent.keyDown(screen.getByRole('button', {name: '항목'}), {
        key: 'F10',
        shiftKey: true,
      });
      expect(
        renderedToolMenuRows(screen.getByRole('menu', {name: '퀵 실행 항목'})),
      ).toEqual(['복제', '이름 바꾸기', '삭제']);
      if (locked) {
        for (const row of screen.getAllByRole('menuitem')) {
          expect(row.getAttribute('aria-disabled')).toBe('true');
          fireEvent.click(row);
        }
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(save).not.toHaveBeenCalled();
      }
    },
  );
  it('copies the row from its menu, and says why a full list cannot', async () => {
    const save = vi.fn(async () => true);
    const view = render(
      <QuickRowEditor
        full={false}
        timersFull={false}
        item={quickItem('black')}
        locked={false}
        save={save}
      >
        <button>항목</button>
      </QuickRowEditor>,
    );
    const row = screen.getByRole('button', {name: '항목'});
    fireEvent.keyDown(row, {key: 'F10', shiftKey: true});
    fireEvent.click(screen.getByRole('menuitem', {name: '복제'}));
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({kind: 'duplicate', id: quickItem('black').id}),
    );
    view.unmount();
    render(
      <QuickRowEditor
        full
        timersFull={false}
        item={quickItem('black')}
        locked={false}
        save={save}
      >
        <button>항목</button>
      </QuickRowEditor>,
    );
    fireEvent.keyDown(screen.getByRole('button', {name: '항목'}), {
      key: 'F10',
      shiftKey: true,
    });
    expect(
      screen
        .getByRole('menuitem', {name: '복제'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      await hoverForTooltip(screen.getByRole('menuitem', {name: '복제'})),
    ).toBeTruthy();
    save.mockClear();
    fireEvent.click(screen.getByRole('menuitem', {name: '복제'}));
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps its row pinned while the delete question is open and releases it after', async () => {
    let pinned: string | null = null;
    const onPinChange = (id: string, active: boolean): void => {
      pinned = active ? id : pinned === id ? null : pinned;
    };
    render(
      <QuickRowEditor
        full={false}
        timersFull={false}
        item={quickItem('black')}
        locked={false}
        save={vi.fn(async () => true)}
        onPinChange={onPinChange}
      >
        <button>항목</button>
      </QuickRowEditor>,
    );
    const {id} = quickItem('black');

    fireEvent.keyDown(screen.getByRole('button', {name: '항목'}), {
      key: 'F10',
      shiftKey: true,
    });
    fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    await screen.findByRole('alertdialog');
    expect(pinned).toBe(id);

    fireEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(pinned).toBeNull();
  });

  it('closes an applied timer addition with its persistence warning and no retry', async () => {
    vi.mocked(crypto.randomUUID)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000998')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000997');
    const fixture = setup();
    failPersistedEdit(fixture.edit);
    fixture.mount();
    await openAddMenu();
    fireEvent.click(screen.getByRole('menuitem', {name: '타이머…'}));
    await screen.findByRole('dialog', {name: '타이머 추가'});
    fireEvent.change(screen.getByRole('textbox', {name: '초'}), {
      target: {value: '30'},
    });
    fireEvent.click(screen.getByRole('button', {name: '추가'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fixture.current().value.items).toHaveLength(8);
    expect(fixture.edit).toHaveBeenCalledOnce();
    expect(fixture.problem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({kind: 'warning', title: '퀵 실행 저장 실패'}),
    );
  });

  it('holds the close gate during the timer rename read and paired write', async () => {
    const fixture = setup();
    const reading = deferred<ReturnType<typeof quickDocument>>();
    fixture.get.mockReturnValueOnce(reading.promise);
    const saving = saveQuickEdit(fixture.api, {
      kind: 'rename',
      id: quickItem('timer').id,
      name: '예배 타이머',
    });
    let closed = false;
    const closing = pendingWritesOf(fixture.api)
      .flush()
      .then(ok => {
        closed = true;
        return ok;
      });
    await act(async () => undefined);
    expect(closed).toBe(false);
    reading.resolve(quickDocument());
    expect(await saving).toMatchObject({ok: true});
    expect(await closing).toBe(true);
    expect(fixture.edit).toHaveBeenCalledExactlyOnceWith({
      type: 'quick.timer.rename',
      name: 'quick',
      quickItemId: quickItem('timer').id,
      timerName: '예배 타이머',
    });
  });
  it('opens a focused duration dialog and creates a new timer instead of selecting an existing one', async () => {
    vi.mocked(crypto.randomUUID)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000998')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000997');
    const fixture = setup();
    fixture.mount();
    await openAddMenu();
    fireEvent.click(screen.getByRole('menuitem', {name: '타이머…'}));
    const dialog = await screen.findByRole('dialog', {name: '타이머 추가'});
    expect(dialog).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {name: '분'}),
    );
    fireEvent.change(screen.getByRole('textbox', {name: '초'}), {
      target: {value: '30'},
    });
    fireEvent.click(screen.getByRole('button', {name: '추가'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fixture.edit).toHaveBeenCalledExactlyOnceWith({
      type: 'quick.timer.create',
      name: 'quick',
      quickItemId: quickId(998),
      timerId: quickId(997),
      duration: 30,
      overrun: true,
    });
    expect(fixture.current().value.items.at(-1)).toMatchObject({
      kind: 'timer',
      ref: quickId(997),
    });
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('cancels adding a timer without creating a definition or row', async () => {
    const fixture = setup();
    fixture.mount();
    await openAddMenu();
    fireEvent.click(screen.getByRole('menuitem', {name: '타이머…'}));
    await screen.findByRole('dialog', {name: '타이머 추가'});
    fireEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(fixture.current().value.items).toHaveLength(7);
  });

  it('renames the timer through its paired command without replacing settings', async () => {
    const fixture = setup();
    fixture.mount();
    const contextTarget = await screen.findByRole('button', {
      name: '시작 카운트다운',
    });
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: '  예배 타이머  '},
    });
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fixture.edit).toHaveBeenCalledExactlyOnceWith({
      type: 'quick.timer.rename',
      name: 'quick',
      quickItemId: quickItem('timer').id,
      timerName: '예배 타이머',
    });
    expect(
      fixture.current().value.items.find(item => item.kind === 'timer')?.name,
    ).toBe('예배 타이머');
  });
  it('waits for quick settings before trying to open the add menu', async () => {
    const fixture = setup();
    const reading = deferred<ReturnType<typeof quickDocument>>();
    const original = fixture.get.getMockImplementation();
    if (!original) throw new Error('Missing settings fixture');
    fixture.get.mockImplementation(request =>
      request.name === 'quick' ? reading.promise : original(request),
    );
    fixture.mount();
    const opening = openAddMenu();
    await act(async () => undefined);
    expect(
      screen
        .getByRole('button', {name: '퀵 실행 추가'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.queryByRole('menu', {name: '퀵 실행 추가'})).toBeNull();
    await act(async () => reading.resolve(quickDocument()));
    await opening;
    expect(screen.getByRole('menuitem', {name: '현재 항목 추가'})).toBeTruthy();
  });
  it.each([
    {group: '그래픽', name: '그래픽 대상', kind: 'prop'},
    {group: '매크로', name: '매크로 대상', kind: 'macro'},
  ])(
    'adds a $kind from its submenu without output',
    async ({group, name, kind}) => {
      const fixture = setup();
      fixture.mount();
      await openAddMenu();
      const submenu = await screen.findByRole('menuitem', {name: group});
      await waitFor(() =>
        expect(submenu.getAttribute('aria-disabled')).not.toBe('true'),
      );
      fireEvent.click(submenu);
      fireEvent.click(await screen.findByRole('menuitem', {name}));
      await waitFor(() =>
        expect(fixture.current().value.items.at(-1)).toMatchObject({
          kind,
          name,
        }),
      );
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.problem).not.toHaveBeenCalled();
    },
  );
});
