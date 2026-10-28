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
