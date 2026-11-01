import {settingsDocument} from '@fixtures/core/settingsDocument';
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import {useMacroPanel} from '@renderer/features/tools/useMacroPanel';
import {useMacroPalette} from '@renderer/features/tools/state/macroPalette';
import {deferred} from '@fixtures/renderer/features/tools/quickTesting';
import {
  firstCollection,
  firstMacro,
  group,
  id,
  macro,
  mockMacroPanel,
} from '@fixtures/renderer/features/tools/macroPanelTesting';

afterEach(() => {
  cleanup();
  useMacroPalette.getState().close();
  delete window.llp;
  vi.restoreAllMocks();
});

async function mount(onProblem = vi.fn()) {
  const view = renderHook(() => useMacroPanel({onProblem}));
  await waitFor(() => expect(view.result.current.locked).toBe(false));
  return view;
}

it('immediately selects a macro in the displayed collection without renaming', async () => {
  const f = mockMacroPanel();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  const {result} = await mount();
  act(() =>
    result.current.selectCollection(firstCollection(result.current).id),
  );
  act(() => result.current.create());
  const created = result.current.macros[1];
  if (!created) throw new Error('Missing new macro');
  expect(created.name).toBe('새 매크로');
  expect(result.current.selectedId).toBe(created.id);
  expect(result.current.editor).toBeNull();
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.collections[0]?.macroIds).toContain(created.id);
  await act(async () => {
    f.push(settingsDocument('macros', edit.value, 2));
    pending.resolve({ok: true, value: {id: 'macros', revision: 2}});
    await pending.promise;
  });
  expect(
    result.current.macros.filter(item => item.id === created.id),
  ).toHaveLength(1);
  expect(result.current.editor).toBeNull();
});

it('rolls back a refused macro creation and reports the failure', async () => {
  const f = mockMacroPanel();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  const onProblem = vi.fn();
  const {result} = await mount(onProblem);
  act(() => result.current.create());
  expect(result.current.macros).toHaveLength(2);
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  await act(async () => {
    pending.resolve({
      ok: false,
      error: {reason: 'read-only', message: 'Refused'},
    });
    await pending.promise;
  });
  expect(result.current.macros.map(item => item.name)).toEqual(['찬양']);
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({title: '매크로 변경 실패'}),
  );
});

it('uses the first free macro name and counts up after each accepted create', async () => {
  const f = mockMacroPanel();
  const {result} = await mount();
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {
          macros: [
            macro,
            {
              ...macro,
              id: '00000000-0000-4000-8000-000000000002',
              name: '새 매크로',
            },
            {
              ...macro,
              id: '00000000-0000-4000-8000-000000000003',
              name: '새 매크로 3',
            },
          ],
          collections: [group],
        },
        2,
      ),
    ),
  );
  f.edit.mockImplementation(async edit => {
    if (edit.name !== 'macros') throw new Error('Unexpected edit');
    f.push(settingsDocument('macros', edit.value, edit.baseRevision + 1));
    return {ok: true, value: {id: 'macros', revision: edit.baseRevision + 1}};
  });
  for (const name of ['새 매크로 2', '새 매크로 4']) {
    act(() => result.current.create());
    expect(
      result.current.macros.find(item => item.id === result.current.selectedId)
        ?.name,
    ).toBe(name);
    await waitFor(() => expect(result.current.locked).toBe(false));
  }
  expect(result.current.editor).toBeNull();
});

it('does not open rename over a newer selection after a delayed creation', async () => {
  const f = mockMacroPanel();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  const {result} = await mount();
  act(() => result.current.create());
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const collectionId = firstCollection(result.current).id;
  act(() => result.current.selectCollection(collectionId));
  await act(async () => {
    pending.resolve({ok: true, value: {id: 'macros', revision: 2}});
    await pending.promise;
  });
  await waitFor(() => expect(result.current.locked).toBe(false));
  expect(result.current.currentCollection).toBe(collectionId);
  expect(result.current.editor).toBeNull();
});

it('creates in all macros after the selected collection is removed', async () => {
  const f = mockMacroPanel();
  const {result} = await mount();
  act(() =>
    result.current.selectCollection(firstCollection(result.current).id),
  );
  act(() =>
    f.push(settingsDocument('macros', {macros: [macro], collections: []}, 2)),
  );
  act(() => result.current.create());
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.collections).toEqual([]);
  expect(edit.value.macros).toHaveLength(2);
});

it('duplicates the selected macro', async () => {
  const f = mockMacroPanel();
  const {result} = await mount();
  act(() =>
    result.current.menuHandlers(firstMacro(result.current)).duplicate(),
  );
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.macros).toHaveLength(2);
  expect(edit.value.macros[1]?.name).toBe('찬양 복사본');
  expect(edit.value.collections[0]?.macroIds).toContain(
    edit.value.macros[1]?.id,
  );
});

it('counts service items before deleting a macro', async () => {
  const f = mockMacroPanel();
  const {result} = await mount();
  act(() => result.current.menuHandlers(firstMacro(result.current)).remove());
  expect(result.current.editor).toMatchObject({kind: 'delete', uses: null});
  expect(f.edit).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(result.current.editor).toMatchObject({kind: 'delete', uses: 2}),
  );
  act(() => result.current.deleteMacro());
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.macros).toEqual([]);
});

it('keeps the selected collection when deleting another collection', async () => {
  const f = mockMacroPanel();
  const other = {
    ...group,
    id: '00000000-0000-4000-8000-000000000008',
    name: 'Other',
  };
  const {result} = await mount();
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {macros: [macro], collections: [group, other]},
        2,
      ),
    ),
  );
  const collection = firstCollection(result.current);
  const removed = result.current.collections[1];
  if (!removed) throw new Error('Missing other collection');
  act(() => result.current.selectCollection(collection.id));
  act(() => result.current.askDeleteCollection(removed));
  act(() => result.current.deleteCollection());
  await waitFor(() => expect(result.current.collectionDialog).toBeNull());
  expect(result.current.currentCollection).toBe(collection.id);
  expect(f.edit).toHaveBeenCalledOnce();
  const deletion = f.edit.mock.calls[0]?.[0];
  if (deletion?.name !== 'macros') throw new Error('Missing deletion');
  expect(deletion.value.collections).toEqual([group]);
  expect(deletion.value.macros).toHaveLength(1);
});

it('does not reset a newer selection after a cancelled pending deletion', async () => {
  const f = mockMacroPanel();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  const other = {
    id: '00000000-0000-4000-8000-000000000008',
    name: 'Other',
    macroIds: [id],
  };
  const {result} = await mount();
  act(() =>
    f.push(
      settingsDocument(
        'macros',
        {macros: [macro], collections: [group, other]},
        2,
      ),
    ),
  );
  const collection = firstCollection(result.current);
  const selected = result.current.collections[1];
  if (!selected) throw new Error('Missing other collection');
  act(() => result.current.selectCollection(collection.id));
  act(() => result.current.askDeleteCollection(collection));
  act(() => result.current.deleteCollection());
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  act(() => result.current.closeCollection());
  act(() => result.current.selectCollection(selected.id));
  await act(async () => {
    pending.resolve({ok: true, value: {id: 'macros', revision: 3}});
    await pending.promise;
  });
  expect(result.current.currentCollection).toBe(selected.id);
});
