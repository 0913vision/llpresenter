import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {deferred} from '@fixtures/renderer/features/tools/quickTesting';
import type {EditResult} from '@core/schema/contentEdit';
import {MacroPanel} from '@renderer/features/tools/macros/MacroPanel';
import {useMacroPalette} from '@renderer/features/tools/macros/useMacroPalette';

import {
  id,
  macro,
  group,
  mockMacroPanel as fixture,
} from '@fixtures/renderer/features/tools/macroPanelTesting';

afterEach(() => {
  cleanup();
  useMacroPalette.getState().close();
  delete window.llp;
  vi.restoreAllMocks();
});

it.each([true, false])(
  'keeps the add tile mounted through an edit with accepted=%s',
  async accepted => {
    const f = fixture();
    const pending = deferred<EditResult>();
    f.edit.mockReturnValueOnce(pending.promise);
    const onProblem = vi.fn();
    render(<MacroPanel onProblem={onProblem} />);
    const add = await screen.findByRole('button', {name: '새 매크로'});
    fireEvent.contextMenu(await screen.findByRole('option', {name: '찬양'}));
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', {name: '시작할 때 실행'}),
    );
    await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', {name: '새 매크로'})).toBe(add);
    expect(add.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(add);
    expect(screen.queryByRole('option', {name: '새 매크로'})).toBeNull();
    expect(f.edit).toHaveBeenCalledOnce();
    const edit = f.edit.mock.calls[0]?.[0];
    if (edit?.name !== 'macros') throw new Error('Missing edit');
    await act(async () => {
      if (accepted) f.push(settingsDocument('macros', edit.value, 2));
      pending.resolve(
        accepted
          ? {ok: true, value: {id: 'macros', revision: 2}}
          : {ok: false, error: {reason: 'read-only', message: 'Refused'}},
      );
      await pending.promise;
    });
    await waitFor(() =>
      expect(add.getAttribute('aria-disabled')).not.toBe('true'),
    );
    expect(screen.getByRole('button', {name: '새 매크로'})).toBe(add);
    if (!accepted) {
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '매크로 변경 실패'}),
      );
    }
  },
);

it('shows and closes the palette requested from View without a macro target', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '찬양'});
  act(() => useMacroPalette.getState().show());
  expect(screen.getByRole('region', {name: '동작 팔레트'})).toBeDefined();
  fireEvent.drop(tile, {
    dataTransfer: {
      types: ['application/x-llpresenter-macro-action'],
      getData: () => 'clearAll',
    },
  });
  await screen.findByRole('dialog', {name: '동작 설정'});
  expect(f.send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  fireEvent.click(screen.getByRole('button', {name: '동작 팔레트 닫기'}));
  expect(screen.queryByRole('region', {name: '동작 팔레트'})).toBeNull();
});

it('runs a macro tile', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '찬양'});
  fireEvent.click(tile);
  expect(f.send).toHaveBeenCalledWith({type: 'macro.run', macroId: id});
  fireEvent.contextMenu(tile);
  expect(tile.hasAttribute('data-menu-target')).toBe(true);
});

it('duplicates the focused macro with Ctrl D, the way its 복제 row does', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '찬양'});
  tile.focus();
  fireEvent.keyDown(tile, {key: 'd', code: 'KeyD', ctrlKey: true});
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros.map(item => item.name)).toEqual(
    expect.arrayContaining(['찬양', '찬양 복사본']),
  );
});

async function openMenu() {
  const tile = await screen.findByRole('option', {name: '찬양'});
  fireEvent.contextMenu(tile);
}

async function openSubmenu(name: string) {
  fireEvent.pointerMove(screen.getByRole('menuitem', {name}));
  await screen.findByRole('menu', {name}, {timeout: 3000});
}

async function openActionSubmenu(name: string) {
  await openMenu();
  await openSubmenu(name);
}

it('appends clear all directly from the menu without a dialog', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('동작 추가');
  await openSubmenu('지우기');
  const clear = screen.getByRole('menu', {name: '지우기'});
  expect(
    [...clear.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
      row => (row.getAttribute('role') === 'separator' ? '|' : row.textContent),
    ),
  ).toEqual([
    '모두 지우기',
    '|',
    '가사',
    '미디어',
    '그래픽',
    '메시지',
    '오디오',
  ]);
  fireEvent.click(screen.getByRole('menuitem', {name: '모두 지우기'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([{kind: 'clearAll'}]);
});

it('adds a layer clear directly from the flat clear submenu', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('동작 추가');
  await openSubmenu('지우기');
  fireEvent.click(
    within(screen.getByRole('menu', {name: '지우기'})).getByRole('menuitem', {
      name: '그래픽',
    }),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([
    {kind: 'clearLayer', layer: 'prop'},
  ]);
});

it('edits and removes actions with their original transition and expected list', async () => {
  const action = {kind: 'clearAll', transition: {fade: true, durationMs: 1200}};
  const f = fixture([action]);
  const view = render(<MacroPanel />);
  await openMenu();
  await openSubmenu('동작 편집: 모두 지우기');
  const current = screen.getByRole('menuitemradio', {name: '모두 지우기'});
  expect(current.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(current);
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([action]);
  view.unmount();
  const next = fixture([action]);
  render(<MacroPanel />);
  await openMenu();
  fireEvent.click(
    screen.getByRole('menuitem', {name: '동작 삭제: 모두 지우기'}),
  );
  await waitFor(() => expect(next.edit).toHaveBeenCalledOnce());
  const removal = next.edit.mock.calls[0]?.[0];
  if (removal?.name !== 'macros') throw new Error('Missing edit');
  expect(removal.value.macros[0]?.actions).toEqual([]);
});

it('adds to a collection only when the macro is not in it yet', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('모음에 추가');
  const member = screen.getByRole('menuitemcheckbox', {name: '주일'});
  expect(member.getAttribute('aria-checked')).toBe('true');
  expect(member.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(member);
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('menu', {name: '모음에 추가'}), {
    key: 'Escape',
  });
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {macros: [macro], collections: [{...group, macroIds: []}]},
        2,
      ),
    ),
  );
  await openSubmenu('모음에 추가');
  const outside = screen.getByRole('menuitemcheckbox', {name: '주일'});
  expect(outside.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(outside);
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const addition = f.edit.mock.calls[0]?.[0];
  if (addition?.name !== 'macros') throw new Error('Missing macro edit');
  expect(addition.value.collections[0]?.macroIds).toEqual([id]);
});

it('moves a macro out of the shown collection into another', async () => {
  const otherId = '00000000-0000-4000-8000-000000000007';
  const f = fixture();
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {
          macros: [macro],
          collections: [group, {id: otherId, name: '수요', macroIds: []}],
        },
        2,
      ),
    ),
  );
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '찬양'});
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  fireEvent.click(screen.getByRole('option', {name: '주일'}));
  await openActionSubmenu('모음으로 옮기기');
  fireEvent.click(screen.getByRole('menuitemcheckbox', {name: '수요'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const last = f.edit.mock.calls[0]?.[0];
  if (last?.name !== 'macros') throw new Error('Missing macro edit');
  expect(last.value.collections.map(item => item.macroIds)).toEqual([[], [id]]);
});

it('cannot move a macro while the tab shows every macro', async () => {
  fixture();
  render(<MacroPanel />);
  await openMenu();
  expect(
    screen
      .getByRole('menuitem', {name: '모음으로 옮기기'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
});

it('opens the palette and drops an action on the target macro without running it', async () => {
  const f = fixture();
  const secondId = '00000000-0000-4000-8000-000000000007';
  const second = {...macro, id: secondId, name: 'Second'};
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '찬양'});
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {macros: [macro, second], collections: [group]},
        2,
      ),
    ),
  );
  await screen.findByRole('option', {name: 'Second'});
  await openActionSubmenu('동작 추가');
  fireEvent.click(screen.getByRole('menuitem', {name: '동작 팔레트'}));
  expect(screen.getByRole('region', {name: '동작 팔레트'})).toBeDefined();
  const dataTransfer = {
    types: ['application/x-llpresenter-macro-action'],
    getData: () => 'clearAll',
    setData: vi.fn(),
    effectAllowed: '',
    dropEffect: '',
  };
  const source = screen.getByRole('button', {
    name: '모두 지우기',
  });
  const palette = source.closest('[data-dragging], [class*="palette"]');
  if (!palette) throw new Error('Missing palette');
  fireEvent.dragStart(source, {dataTransfer});
  expect(palette.hasAttribute('data-dragging')).toBe(true);
  const target = screen.getByRole('option', {name: 'Second'});
  fireEvent.dragOver(target, {dataTransfer});
  expect(dataTransfer.dropEffect).toBe('copy');
  fireEvent.drop(target, {dataTransfer});
  fireEvent.dragEnd(source, {dataTransfer});
  expect(palette.hasAttribute('data-dragging')).toBe(false);
  await screen.findByRole('dialog', {name: '동작 설정'});
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '적용'}).getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  fireEvent.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[1]?.actions).toEqual([{kind: 'clearAll'}]);
  expect(f.send).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', {
      name: '동작 팔레트 닫기',
    }),
  );
  expect(screen.queryByRole('region', {name: '동작 팔레트'})).toBeNull();
});

it('ignores unknown external action drops', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '찬양'});
  fireEvent.drop(tile, {
    dataTransfer: {types: ['text/plain'], getData: () => 'clearAll'},
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.edit).not.toHaveBeenCalled();
  expect(f.send).not.toHaveBeenCalled();
});

async function selectCollection(name: string) {
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  fireEvent.click(
    within(screen.getByRole('dialog', {name: '매크로 모음'})).getByRole(
      'option',
      {name},
    ),
  );
}

function collectionMenu(name: string) {
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  fireEvent.contextMenu(
    within(screen.getByRole('dialog', {name: '매크로 모음'})).getByRole(
      'option',
      {name},
    ),
  );
}

it('renames and deletes the displayed collection while retaining macros', async () => {
  const f = fixture();
  const view = render(<MacroPanel />);
  await screen.findByRole('option', {name: '찬양'});
  await selectCollection('주일');
  collectionMenu('주일');
  fireEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
  const field = await screen.findByRole('textbox', {name: '모음 이름'});
  fireEvent.change(field, {
    target: {value: 'Team'},
  });
  fireEvent.keyDown(field, {key: 'Enter'});
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const rename = f.edit.mock.calls[0]?.[0];
  if (rename?.name !== 'macros') throw new Error('Missing edit');
  expect(rename.value.collections[0]?.name).toBe('Team');
  view.unmount();
  const next = fixture();
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '찬양'});
  await selectCollection('주일');
  collectionMenu('주일');
  fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  await waitFor(() => expect(next.edit).toHaveBeenCalledOnce());
  const deletion = next.edit.mock.calls[0]?.[0];
  if (deletion?.name !== 'macros') throw new Error('Missing edit');
  expect(deletion.value.collections).toEqual([]);
  expect(deletion.value.macros).toHaveLength(1);
});

it('turns the remove row into a submenu with two or more actions', async () => {
  const f = fixture([{kind: 'clearAll'}, {kind: 'clearAll'}]);
  render(<MacroPanel />);
  await openMenu();
  expect(screen.queryByRole('menuitem', {name: /^동작 삭제:/})).toBeNull();
  await openSubmenu('동작 삭제');
  fireEvent.click(screen.getByRole('menuitem', {name: '모두 삭제'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([]);
  expect(document.activeElement?.contains(screen.getByRole('listbox'))).toBe(
    true,
  );
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: ' ',
    code: 'Space',
  });
  fireEvent.keyUp(document.activeElement ?? document.body, {
    key: ' ',
    code: 'Space',
  });
  expect(f.send).not.toHaveBeenCalled();
});

it('keeps deletion history focused after deleting a macro action', async () => {
  const f = fixture([{kind: 'clearAll'}]);
  render(
    <div data-workspace-layout="show">
      <div data-show-slide-grid>
        <div role="listbox" aria-label="슬라이드" tabIndex={-1} />
      </div>
      <MacroPanel />
    </div>,
  );
  await openMenu();
  fireEvent.click(screen.getByRole('menuitem', {name: /^동작 삭제:/}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  expect(
    document.activeElement?.contains(
      screen.getByRole('option', {name: '찬양'}),
    ),
  ).toBe(true);
  expect(document.activeElement).not.toBe(
    screen.getByRole('listbox', {name: '슬라이드'}),
  );
  expect(f.send).not.toHaveBeenCalled();
});

it('appends a timer operation from nested target menus', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('동작 추가');
  await openSubmenu('타이머');
  await openSubmenu('예배 시작');
  fireEvent.click(screen.getByRole('menuitem', {name: '일시 정지'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([
    {
      kind: 'timer',
      timer: '00000000-0000-4000-8000-000000000011',
      operation: 'pause',
    },
  ]);
  expect(f.send).not.toHaveBeenCalled();
});
