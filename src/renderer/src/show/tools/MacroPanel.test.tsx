import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {
  parseServiceDocument,
  parseServiceEntries,
} from '@shared/schema/contentDocuments';
import {settingsDocument} from '@renderer/screens/testing/documents';
import {deferred} from '../quick/quickTesting';
import type {EditResult} from '@shared/schema/contentEdit';
import {MacroPanel} from './MacroPanel';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {stageFixture} from './stageTesting';

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
  delete window.llp;
  vi.restoreAllMocks();
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

it('creates a macro in the displayed collection then opens rename', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const select = await screen.findByRole('button', {name: '매크로 모음'});
  await screen.findByRole('option', {name: '찬양'});
  fireEvent.click(select);
  fireEvent.click(screen.getByRole('menuitemradio', {name: '주일'}));
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
  fireEvent.click(screen.getByRole('menuitemradio', {name: '주일'}));
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
  fireEvent.click(screen.getByRole('menuitemradio', {name: '\uc8fc\uc77c'}));
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

async function openActionSubmenu(name: string) {
  const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.contextMenu(tile);
  fireEvent.pointerEnter(screen.getByRole('menuitem', {name}));
  await screen.findByRole('menu', {name});
}

it('adds an action from the menu after configuring it', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('\ub3d9\uc791 \ucd94\uac00');
  fireEvent.click(
    screen.getByRole('menuitem', {name: '\ubaa8\ub450 \uc9c0\uc6b0\uae30'}),
  );
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
  expect(edit.value.macros[0]?.actions).toEqual([{kind: 'clearAll'}]);
});

it('edits and removes actions with their original transition and expected list', async () => {
  const action = {kind: 'clearAll', transition: {fade: true, durationMs: 1200}};
  const f = fixture([action]);
  const view = render(<MacroPanel />);
  await openActionSubmenu('\ub3d9\uc791 \ud3b8\uc9d1');
  fireEvent.click(
    screen.getByRole('menuitem', {name: '1. \ubaa8\ub450 \uc9c0\uc6b0\uae30'}),
  );
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
  expect(edit.value.macros[0]?.actions).toEqual([action]);
  view.unmount();
  const next = fixture([action]);
  render(<MacroPanel />);
  await openActionSubmenu('\ub3d9\uc791 \ube7c\uae30');
  fireEvent.click(
    screen.getByRole('menuitem', {name: '1. \ubaa8\ub450 \uc9c0\uc6b0\uae30'}),
  );
  await waitFor(() => expect(next.edit).toHaveBeenCalledOnce());
  const removal = next.edit.mock.calls[0]?.[0];
  if (removal?.name !== 'macros') throw new Error('Missing edit');
  expect(removal.value.macros[0]?.actions).toEqual([]);
});

it('toggles membership using the current collection state', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('\ubaa8\uc74c');
  const checked = screen.getByRole('menuitemcheckbox', {name: '\uc8fc\uc77c'});
  expect(checked.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(checked);
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.collections[0]?.macroIds).toEqual([]);
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {macros: [macro], collections: [{...group, macroIds: []}]},
        2,
      ),
    ),
  );
  await openActionSubmenu('\ubaa8\uc74c');
  const unchecked = screen.getByRole('menuitemcheckbox', {
    name: '\uc8fc\uc77c',
  });
  expect(unchecked.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(unchecked);
  await waitFor(() => expect(f.edit).toHaveBeenCalledTimes(2));
  const addition = f.edit.mock.calls[1]?.[0];
  if (addition?.name !== 'macros') throw new Error('Missing macro edit');
  expect(addition.value.collections[0]?.macroIds).toEqual([id]);
});

it('creates a new collection containing the selected macro', async () => {
  const f = fixture();
  render(<MacroPanel />);
  await openActionSubmenu('\ubaa8\uc74c');
  fireEvent.click(screen.getByRole('menuitem', {name: '\uc0c8 \ubaa8\uc74c'}));
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

it('selects a color with the keyboard and leaves the menu open', async () => {
  const f = fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.contextMenu(tile);
  fireEvent.click(screen.getByRole('menuitem', {name: '\uc0c9'}));
  const teal = screen.getByRole('radio', {name: '\uccad\ub85d'});
  expect(document.activeElement).toBe(teal);
  fireEvent.keyDown(teal, {key: 'ArrowRight'});
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.macros[0]?.color).toBe('green');
  expect(screen.getByRole('menu', {name: '\ub9e4\ud06c\ub85c'})).toBeDefined();
});

it.each([
  ['ArrowUp', '\uc544\uc774\ucf58 \ubc14\uafb8\uae30'],
  ['ArrowDown', '\ub3d9\uc791 \ucd94\uac00'],
])(
  'returns from the color row to menu navigation with %s',
  async (key, expected) => {
    Element.prototype.scrollIntoView = vi.fn();
    fixture();
    render(<MacroPanel />);
    const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
    fireEvent.contextMenu(tile);
    const color = screen.getByRole('menuitem', {name: '\uc0c9'});
    fireEvent.pointerEnter(color);
    fireEvent.click(color);
    const teal = screen.getByRole('radio', {name: '\uccad\ub85d'});
    expect(document.activeElement).toBe(teal);
    fireEvent.keyDown(teal, {key});
    const menu = screen.getByRole('menu', {name: '\ub9e4\ud06c\ub85c'});
    expect(document.activeElement).toBe(menu);
    const pointed = document.getElementById(
      menu.getAttribute('aria-activedescendant') ?? '',
    );
    expect(pointed?.textContent).toBe(expected);
  },
);

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
  fireEvent.click(screen.getByRole('menuitemradio', {name}));
}

it('renames and deletes the displayed collection while retaining macros', async () => {
  const f = fixture();
  const view = render(<MacroPanel />);
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
  await selectCollection('\uc8fc\uc77c');
  fireEvent.click(
    screen.getByRole('button', {name: '\ub9e4\ud06c\ub85c \ubaa8\uc74c'}),
  );
  fireEvent.click(
    screen.getByRole('menuitem', {name: '\uc774\ub984 \ubc14\uafb8\uae30'}),
  );
  fireEvent.change(screen.getByRole('textbox', {name: '\uc774\ub984'}), {
    target: {value: 'Team'},
  });
  fireEvent.click(screen.getByRole('button', {name: '\uc800\uc7a5'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const rename = f.edit.mock.calls[0]?.[0];
  if (rename?.name !== 'macros') throw new Error('Missing edit');
  expect(rename.value.collections[0]?.name).toBe('Team');
  view.unmount();
  const next = fixture();
  render(<MacroPanel />);
  await screen.findByRole('option', {name: '\ucc2c\uc591'});
  await selectCollection('\uc8fc\uc77c');
  fireEvent.click(
    screen.getByRole('button', {name: '\ub9e4\ud06c\ub85c \ubaa8\uc74c'}),
  );
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
  fireEvent.click(
    screen.getByRole('button', {name: '\ub9e4\ud06c\ub85c \ubaa8\uc74c'}),
  );
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

it('divides the macro menu into the specified command groups', async () => {
  fixture();
  render(<MacroPanel />);
  const tile = await screen.findByRole('option', {name: '\ucc2c\uc591'});
  fireEvent.contextMenu(tile);
  expect(screen.getAllByRole('separator')).toHaveLength(4);
});
