import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {MacroEditors} from '@renderer/features/tools/macros/editor/MacroEditors';
import {
  useMacroPanel,
  type MacroPanelModel,
} from '@renderer/features/tools/macros/useMacroPanel';
import {useMacroPalette} from '@renderer/features/tools/macros/actions/useMacroPalette';
import {
  firstMacro,
  group,
  id,
  mockMacroPanel,
} from '@fixtures/renderer/features/tools/macroPanelTesting';

afterEach(() => {
  cleanup();
  useMacroPalette.getState().close();
  delete window.llp;
  vi.restoreAllMocks();
});

async function mount() {
  let current: MacroPanelModel | undefined;
  function Host() {
    current = useMacroPanel({});
    return (
      <>
        <button>찬양</button>
        <MacroEditors model={current} />
      </>
    );
  }
  const view = render(<Host />);
  const host = {
    ...view,
    get model() {
      if (!current) throw new Error('Missing panel model');
      return current;
    },
  };
  await waitFor(() => expect(host.model.locked).toBe(false));
  return host;
}

it('restores and saves macro view and collection', async () => {
  mockMacroPanel();
  const api = window.llp;
  if (api === undefined) throw new Error('Missing API');
  const collection = (
    await import('@core/schema/common/ids')
  ).parseMacroCollectionId(group.id);
  if (!collection.ok) throw new Error('Invalid collection');
  vi.spyOn(api.ui, 'get').mockResolvedValue({
    macroView: 'list',
    macroCollection: collection.value,
  });
  const save = vi.spyOn(api.ui, 'setRememberedView');
  const host = await mount();
  await waitFor(() => expect(host.model.currentCollection).toBe(group.id));
  expect(host.model.mode).toBe('list');
  act(() => host.model.changeMode('grid'));
  act(() => host.model.selectCollection(undefined));
  expect(save).toHaveBeenCalledWith({macroView: 'grid'});
  expect(save).toHaveBeenCalledWith({macroCollection: null});
});

it('opens eight color swatches at the macro anchor, restores focus, and saves a choice', async () => {
  const f = mockMacroPanel();
  const host = await mount();
  const anchor = screen.getByRole('button', {name: '찬양'});
  const box = vi
    .spyOn(anchor, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(80, 100, 100, 50));
  const open = () => {
    act(() =>
      host.model.openMenu(
        firstMacro(host.model),
        {kind: 'element', element: anchor},
        anchor,
      ),
    );
    act(() => host.model.menuHandlers(firstMacro(host.model)).changeColor());
    act(() => host.model.closeMenu());
  };
  open();
  const popup = screen.getByRole('dialog', {name: '매크로 색'});
  expect(screen.queryByRole('menu')).toBeNull();
  expect(box).toHaveBeenCalled();
  expect(screen.getAllByRole('radio')).toHaveLength(8);
  const selected = screen.getByRole('radio', {name: '청록'});
  expect(selected.getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(selected);
  fireEvent.keyDown(popup, {key: 'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(anchor);
  open();
  await userEvent.click(screen.getByRole('radio', {name: '분홍'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing macro edit');
  expect(edit.value.macros[0]?.color).toBe('rose');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(anchor);
});

it('creates a new collection containing the selected macro', async () => {
  const f = mockMacroPanel();
  const host = await mount();
  act(() => host.model.menuHandlers(firstMacro(host.model)).newCollection());
  expect(screen.getByRole('dialog', {name: '새 모음'})).toBeDefined();
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: 'Team'},
  });
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.collections[1]).toMatchObject({
    name: 'Team',
    macroIds: [id],
  });
});

it('saves an icon chosen for the macro', async () => {
  const f = mockMacroPanel();
  const host = await mount();
  act(() => host.model.menuHandlers(firstMacro(host.model)).changeIcon());
  fireEvent.click(screen.getByRole('button', {name: '아이콘 sun'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing edit');
  expect(edit.value.macros[0]?.icon).toBe('sun');
});

it('opens the message dialog with the picked template before saving', async () => {
  const f = mockMacroPanel();
  f.documents.set(
    'messages',
    settingsDocument('messages', {
      templates: [{id, name: '안내', icon: 'msg', text: '안녕하세요'}],
    }),
  );
  const host = await mount();
  act(() =>
    host.model
      .menuHandlers(firstMacro(host.model))
      .chooseAction({kind: 'message', target: id}),
  );
  await screen.findByRole('dialog', {name: '동작 설정'});
  await waitFor(() =>
    expect(screen.getByRole('button', {name: '대상'}).textContent).toContain(
      '안내',
    ),
  );
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
});
