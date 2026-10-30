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
import {
  parseServiceDocument,
  parseServiceEntries,
} from '@core/schema/contentDocuments';
import {settingsDocument} from '@renderer/screens/testing/documents';
import {deferred} from '../quick/quickTesting';
import type {EditResult} from '@core/schema/contentEdit';
import {MacroPanel} from './MacroPanel';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {stageFixture} from './stageTesting';
import userEvent from '@testing-library/user-event';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {useScreensSelection} from '@renderer/screens/selection';
import {useMacroPalette} from '@renderer/state/macroPalette';
import {LOOK_ID, LAYOUT_ID} from '@renderer/screens/testing/documents';

const id = '00000000-0000-4000-8000-000000000001';
const groupId = '00000000-0000-4000-8000-000000000002';
const serviceId = '00000000-0000-4000-8000-000000000003';
const macro = {id, name: '찬양', icon: 'macro', color: 'teal', actions: []};
const group = {id: groupId, name: '주일', macroIds: [id]};
const entries = parseServiceEntries([
  {id: serviceId, name: '예배', date: '2026-11-01T11:00', access: 'editable'},
]);
const service = parseServiceDocument({
  revision: 1,
  access: 'editable',
  service: {
    format: 'llservice',
    schemaVersion: 1,
    id: serviceId,
    name: '예배',
    date: '2026-11-01T11:00',
    order: [
      {
        id: '00000000-0000-4000-8000-000000000004',
        media: '00000000-0000-4000-8000-000000000005',
        macro: id,
      },
      {
        id: '00000000-0000-4000-8000-000000000006',
        media: '00000000-0000-4000-8000-000000000005',
        macro: id,
      },
    ],
  },
});
if (!entries.ok || !service.ok || !service.value) {
  throw new Error('Invalid fixture');
}
const serviceEntries = entries.value;
const serviceDocument = service.value;

function fixture(actions: readonly object[] = []) {
  const f = stageFixture([
    settingsDocument('macros', {
      macros: [{...macro, actions}],
      collections: [group],
    }),
    settingsDocument('props', {props: []}),
    settingsDocument('notices', {sets: []}),
  ]);
  const api = window.llp;
  if (!api) throw new Error('Missing API');
  const media = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [],
      audioPlaylists: [],
    },
  });
  if (!media.ok) throw new Error('Invalid media');
  window.llp = {
    ...api,
    media: {
      ...api.media,
      get: async () => media.value,
      subscribe: () => () => undefined,
    },
    services: {
      ...api.services,
      list: async () => serviceEntries,
      get: async () => serviceDocument,
    },
  };
  f.edit.mockResolvedValue({ok: true, value: {id: 'macros', revision: 2}});
  return f;
}
afterEach(() => {
  cleanup();
  useMacroPalette.getState().close();
  delete window.llp;
  vi.restoreAllMocks();
});

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

it('runs a macro and asks with the number of service items before deletion', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '찬양'});
  fireEvent.click(tile);
  expect(f.send).toHaveBeenCalledWith({type: 'macro.run', macroId: id});
  fireEvent.contextMenu(tile);
  fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
  await screen.findByText('예배 순서 항목 2곳에서 씀');
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '삭제'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
});

it('opens eight color swatches at the macro tile, restores focus, and saves a choice', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '찬양'});
  const box = vi
    .spyOn(tile, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(80, 100, 100, 50));
  fireEvent.contextMenu(tile, {clientX: 400, clientY: 300});
  fireEvent.click(screen.getByRole('menuitem', {name: '색 바꾸기'}));
  const popup = screen.getByRole('dialog', {name: '매크로 색'});
  expect(screen.queryByRole('menu')).toBeNull();
  expect(box).toHaveBeenCalled();
  expect(screen.getAllByRole('radio')).toHaveLength(8);
  const selected = screen.getByRole('radio', {name: '청록'});
  expect(selected.getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(selected);
  fireEvent.keyDown(popup, {key: 'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(tile);
  fireEvent.contextMenu(tile);
  fireEvent.click(screen.getByRole('menuitem', {name: '색 바꾸기'}));
  await userEvent.click(screen.getByRole('radio', {name: '분홍'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.macros[0]?.color).toBe('rose');
  await waitFor(() =>
    expect(screen.queryByRole('dialog', {name: '매크로 색'})).toBeNull(),
  );
  expect(document.activeElement).toBe(tile);
});

it('creates a macro in the displayed collection then opens rename', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const select = await screen.findByRole('button', {name: '매크로 모음'});
  await screen.findByRole('option', {name: '찬양'});
  fireEvent.click(select);
  fireEvent.click(screen.getByRole('option', {name: '주일'}));
  fireEvent.click(screen.getByRole('button', {name: '새 매크로'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  const created = edit.value.macros[1];
  if (!created) throw new Error('Missing new macro');
  expect(created.name).toBe('새 매크로');
  expect(edit.value.collections[0]?.macroIds).toContain(created.id);
  expect(
    await screen.findByRole('dialog', {name: '매크로 이름 바꾸기'}),
  ).toBeDefined();
});

it('does not open rename over a newer selection after a delayed creation', async () => {
  const f = fixture();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '찬양'});
  fireEvent.click(screen.getByRole('button', {name: '새 매크로'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  fireEvent.click(screen.getByRole('option', {name: '주일'}));
  pending.resolve({ok: true, value: {id: 'macros', revision: 2}});
  await screen.findByRole('button', {name: '새 매크로'});
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '매크로 모음'}).textContent,
    ).toContain('주일'),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('creates in all macros after the selected collection is removed', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.click(
    screen.getByRole('button', {name: '\ub9e4\ud06c\ub85c \ubaa8\uc74c'}),
  );
  fireEvent.click(screen.getByRole('option', {name: '\uc8fc\uc77c'}));
  act(() =>
    f.push(settingsDocument('macros', {macros: [macro], collections: []}, 2)),
  );
  fireEvent.click(
    screen.getByRole('button', {name: '\uc0c8 \ub9e4\ud06c\ub85c'}),
  );
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.collections).toEqual([]);
  expect(edit.value.macros).toHaveLength(2);
});

it('duplicates the selected macro from its context menu', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.contextMenu(tile);
  fireEvent.click(screen.getByRole('menuitem', {name: '\ubcf5\uc81c'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.macros).toHaveLength(2);
  expect(edit.value.macros[1]?.name).toBe('\ucc2c\uc591 \ubcf5\uc0ac\ubcf8');
  expect(edit.value.collections[0]?.macroIds).toContain(
    edit.value.macros[1]?.id,
  );
});

async function openMenu() {
  const tile = await screen.findByRole('option', {name: '찬양'});
  fireEvent.contextMenu(tile);
}

async function openSubmenu(name: string) {
  fireEvent.pointerEnter(screen.getByRole('menuitem', {name}));
  await screen.findByRole('menu', {name});
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
  fireEvent.click(screen.getByRole('menuitem', {name: '모두 지우기'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([{kind: 'clearAll'}]);
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
    screen.getByRole('menuitem', {name: '동작 빼기: 모두 지우기'}),
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

it('creates a new collection containing the selected macro', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('모음에 추가');
  fireEvent.click(screen.getByRole('menuitem', {name: '새 모음'}));
  const dialog = screen.getByRole('dialog', {name: '\uc0c8 \ubaa8\uc74c'});
  expect(dialog).toBeDefined();
  fireEvent.change(screen.getByRole('textbox', {name: '\uc774\ub984'}), {
    target: {value: 'Team'},
  });
  fireEvent.click(screen.getByRole('button', {name: '\ucd94\uac00'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.collections[1]).toMatchObject({
    name: 'Team',
    macroIds: [id],
  });
});

it('saves an icon chosen from the macro menu', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.contextMenu(tile);
  fireEvent.click(
    screen.getByRole('menuitem', {
      name: '\uc544\uc774\ucf58 \ubc14\uafb8\uae30',
    }),
  );
  fireEvent.click(screen.getByRole('button', {name: '\uc544\uc774\ucf58 sun'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.icon).toBe('sun');
});

it('opens the palette and drops an action on the target macro without running it', async () => {
  const f = fixture();
  const secondId = '00000000-0000-4000-8000-000000000007';
  const second = {...macro, id: secondId, name: 'Second'};
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
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
  await openActionSubmenu('\ub3d9\uc791 \ucd94\uac00');
  fireEvent.click(
    screen.getByRole('menuitem', {name: '\ub3d9\uc791 \ud314\ub808\ud2b8'}),
  );
  expect(
    screen.getByRole('region', {name: '\ub3d9\uc791 \ud314\ub808\ud2b8'}),
  ).toBeDefined();
  const dataTransfer = {
    types: ['application/x-llpresenter-macro-action'],
    getData: () => 'clearAll',
    setData: vi.fn(),
    effectAllowed: '',
    dropEffect: '',
  };
  const source = screen.getByRole('button', {
    name: '\ubaa8\ub450 \uc9c0\uc6b0\uae30',
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
  await screen.findByRole('dialog', {name: '\ub3d9\uc791 \uc124\uc815'});
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', {name: '\uc644\ub8cc'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  fireEvent.click(screen.getByRole('button', {name: '\uc644\ub8cc'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[1]?.actions).toEqual([{kind: 'clearAll'}]);
  expect(f.send).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', {
      name: '\ub3d9\uc791 \ud314\ub808\ud2b8 \ub2eb\uae30',
    }),
  );
  expect(
    screen.queryByRole('region', {name: '\ub3d9\uc791 \ud314\ub808\ud2b8'}),
  ).toBeNull();
});

it('ignores unknown external action drops', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.drop(tile, {
    dataTransfer: {types: ['text/plain'], getData: () => 'clearAll'},
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.edit).not.toHaveBeenCalled();
  expect(f.send).not.toHaveBeenCalled();
});

async function selectCollection(name: string) {
  fireEvent.click(
    screen.getByRole('button', {name: '\ub9e4\ud06c\ub85c \ubaa8\uc74c'}),
  );
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
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
  await selectCollection('\uc8fc\uc77c');
  collectionMenu('주일');
  fireEvent.click(
    screen.getByRole('menuitem', {name: '\uc774\ub984 \ubc14\uafb8\uae30'}),
  );
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
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
  await selectCollection('\uc8fc\uc77c');
  collectionMenu('주일');
  fireEvent.click(screen.getByRole('menuitem', {name: '\uc0ad\uc81c'}));
  expect(
    screen.getByRole('alertdialog', {
      name: '\u2018\uc8fc\uc77c\u2019 \ubaa8\uc74c\uc744 \uc0ad\uc81c\ud560\uae4c\uc694?',
    }),
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name: '\uc0ad\uc81c'}));
  await waitFor(() => expect(next.edit).toHaveBeenCalledOnce());
  const deletion = next.edit.mock.calls[0]?.[0];
  if (deletion?.name !== 'macros') throw new Error('Missing edit');
  expect(deletion.value.collections).toEqual([]);
  expect(deletion.value.macros).toHaveLength(1);
});

it('keeps the selected collection when deleting another collection', async () => {
  const f = fixture();
  const other = {
    ...group,
    id: '00000000-0000-4000-8000-000000000008',
    name: 'Other',
  };
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '찬양'});
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {
          macros: [macro],
          collections: [group, other],
        },
        2,
      ),
    ),
  );
  await selectCollection('주일');
  collectionMenu('Other');
  fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(
    screen.getByRole('button', {name: '매크로 모음'}).textContent,
  ).toContain('주일');
  expect(f.edit).toHaveBeenCalledOnce();
  const deletion = f.edit.mock.calls[0]?.[0];
  if (deletion?.name !== 'macros') throw new Error('Missing deletion');
  expect(deletion.value.collections).toEqual([group]);
  expect(deletion.value.macros).toHaveLength(1);
});

it('does not reset a newer selection after a cancelled pending deletion', async () => {
  const f = fixture();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  const other = {
    id: '00000000-0000-4000-8000-000000000008',
    name: 'Other',
    macroIds: [id],
  };
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {macros: [macro], collections: [group, other]},
        2,
      ),
    ),
  );
  await selectCollection('\uc8fc\uc77c');
  collectionMenu('주일');
  fireEvent.click(screen.getByRole('menuitem', {name: '\uc0ad\uc81c'}));
  fireEvent.click(screen.getByRole('button', {name: '\uc0ad\uc81c'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', {name: '\ucde8\uc18c'}));
  await selectCollection('Other');
  await act(async () => {
    pending.resolve({ok: true, value: {id: 'macros', revision: 3}});
    await pending.promise;
  });
  expect(
    screen.getByRole('button', {name: '\ub9e4\ud06c\ub85c \ubaa8\uc74c'})
      .textContent,
  ).toContain('Other');
});

it('lists the rows of the ProPresenter macro menu in its order', async () => {
  fixture([{kind: 'clearAll'}]);
  render(<MacroPanel />);
  await openMenu();
  const menu = screen.getByRole('menu', {name: '매크로'});
  const rows = [
    ...menu.querySelectorAll('[role^="menuitem"], [role="separator"]'),
  ].map(row =>
    row.getAttribute('role') === 'separator' ? '|' : row.textContent,
  );
  expect(rows).toEqual([
    '모음에 추가',
    '모음으로 옮기기',
    '|',
    '이름 바꾸기',
    '색 바꾸기',
    '아이콘 바꾸기',
    '시작할 때 실행',
    '|',
    '동작 추가',
    '미디어 동작 추가…',
    '|',
    '동작 편집: 모두 지우기',
    '동작 빼기: 모두 지우기',
    '|',
    '속성…',
    '|',
    '잘라내기',
    '복사',
    '붙여넣기',
    '복제',
    '|',
    '삭제',
  ]);
  expect(screen.queryByRole('menuitem', {name: '실행'})).toBeNull();
  for (const name of [
    '미디어 동작 추가…',
    '속성…',
    '잘라내기',
    '복사',
    '붙여넣기',
  ]) {
    const row = screen.getByRole('menuitem', {name});
    expect(row.getAttribute('aria-disabled')).toBe('true');
  }
});

it('turns the remove row into a submenu with two or more actions', async () => {
  const f = fixture([{kind: 'clearAll'}, {kind: 'clearAll'}]);
  render(<MacroPanel />);
  await openMenu();
  expect(screen.queryByRole('menuitem', {name: /^동작 빼기:/})).toBeNull();
  await openSubmenu('동작 빼기');
  fireEvent.click(screen.getByRole('menuitem', {name: '모두 빼기'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.actions).toEqual([]);
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

it('opens the message dialog with the picked template before saving', async () => {
  const f = fixture();
  f.documents.set(
    'messages',
    settingsDocument('messages', {
      templates: [{id, name: '안내', icon: 'msg', text: '안녕하세요'}],
      stagePresets: [],
    }),
  );
  render(<MacroPanel />);
  await openActionSubmenu('동작 추가');
  await openSubmenu('메시지');
  fireEvent.click(screen.getByRole('menuitem', {name: '안내…'}));
  await screen.findByRole('dialog', {name: '동작 설정'});
  await waitFor(() =>
    expect(screen.getByRole('button', {name: '대상'}).textContent).toContain(
      '안내',
    ),
  );
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '완료'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
});

it('lists action kinds in order and opens the selected Look editor', async () => {
  fixture([{kind: 'look', look: LOOK_ID}]);
  const navigate = vi.fn();
  render(
    <WorkspaceNavigation value={navigate}>
      <MacroPanel />
    </WorkspaceNavigation>,
  );
  await openActionSubmenu('동작 추가');
  const menu = screen.getByRole('menu', {name: '동작 추가'});
  expect(
    [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
      row => (row.getAttribute('role') === 'separator' ? '|' : row.textContent),
    ),
  ).toEqual([
    '지우기',
    'Look 바꾸기',
    '무대 화면 배치…',
    '슬라이드 출력 대상',
    '타이머',
    '소품',
    '메시지',
    '공지',
    '배경 미디어',
    '오디오',
    '오디오 재생 목록',
    '외부 장치 신호',
    '오디오 입력',
    '비디오 입력',
    '매크로',
    '녹화와 방송',
    '|',
    '동작 팔레트',
  ]);
  fireEvent.keyDown(menu, {key: 'Escape'});
  await openSubmenu('동작 편집: 평상시');
  const edit = screen.getByRole('menu', {name: '동작 편집: 평상시'});
  expect(
    [...edit.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
      row => (row.getAttribute('role') === 'separator' ? '|' : row.textContent),
    ),
  ).toEqual(['평상시', '설교', '|', '동작 빼기: 평상시', 'Look 편집…']);
  expect(
    screen
      .getByRole('menuitemradio', {name: '평상시'})
      .getAttribute('aria-checked'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('menuitem', {name: 'Look 편집…'}));
  expect(navigate).toHaveBeenCalledExactlyOnceWith('screens');
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'look',
    id: LOOK_ID,
  });
});

it('prevents a second stage-layout action', async () => {
  fixture([{kind: 'stageLayout', layout: LAYOUT_ID}]);
  render(<MacroPanel />);
  await openActionSubmenu('동작 추가');
  expect(
    screen
      .getByRole('menuitem', {name: '무대 화면 배치…'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
});
