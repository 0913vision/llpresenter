import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {settingsDocument} from '@core/testing/screenDocuments';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import {stageFixture} from './stageTesting';
import {MacroPanel} from './MacroPanel';

const first = {
  id: '00000000-0000-4000-8000-000000000002',
  name: '주일',
  macroIds: [],
};
const second = {
  ...first,
  id: '00000000-0000-4000-8000-000000000003',
  name: '평일',
};
function setup(readOnly = false) {
  const doc = settingsDocument('macros', {
    collections: [first, second],
    macros: [],
    future: true,
  });
  const f = stageFixture([
    {...doc, access: readOnly ? 'readOnly' : 'editable'},
  ]);
  f.edit.mockImplementation(async edit => {
    if (edit.name !== 'macros') throw new Error('Unexpected settings edit');
    f.push(settingsDocument('macros', edit.value, edit.baseRevision + 1));
    return {ok: true, value: {id: 'macros', revision: edit.baseRevision + 1}};
  });
  render(<MacroPanel />);
  return f;
}
async function open() {
  await waitFor(() =>
    expect(screen.getByRole('button', {name: '새 매크로'})).toBeDefined(),
  );
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  return screen.getByRole('dialog', {name: '매크로 모음'});
}
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
  resetTooltips();
});

it('lists collections first and the row menu in spec order with immutable all macros', async () => {
  const f = setup();
  const popup = await open();
  const rows = within(popup).getAllByRole('option');
  expect(rows.map(row => row.textContent)).toEqual([
    '모든 매크로',
    '주일',
    '평일',
  ]);
  expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
  expect(popup.querySelector('[aria-checked]')).toBeNull();
  const all = within(popup).getByRole('option', {name: '모든 매크로'});
  fireEvent.keyDown(all, {key: 'ContextMenu'});
  const menu = screen.getByRole('menu', {name: '매크로 모음 메뉴'});
  expect(
    [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
      row => (row.getAttribute('role') === 'separator' ? '|' : row.textContent),
    ),
  ).toEqual(['복제', '이름 바꾸기', '|', '삭제']);
  for (const item of within(menu).getAllByRole('menuitem')) {
    expect(item.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(item);
  }
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.keyDown(menu, {key: 'Escape'});
  expect(screen.getByRole('dialog', {name: '매크로 모음'})).toBe(popup);
});

it('adds a collection and immediately selects its inline name for editing', async () => {
  const f = setup();
  const popup = await open();
  fireEvent.click(within(popup).getByRole('button', {name: '새 매크로 모음'}));
  const field = await screen.findByRole('textbox', {name: '모음 이름'});
  expect(document.activeElement).toBe(field);
  expect(field.getAttribute('value')).toBe('새 모음');
  expect(field.closest('[role="option"]')?.getAttribute('aria-selected')).toBe(
    'true',
  );
  fireEvent.change(field, {target: {value: ''}});
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(screen.getByRole('textbox', {name: '모음 이름'})).toBe(field);
  fireEvent.change(field, {target: {value: '찬양 모음'}});
  fireEvent.keyDown(field, {key: 'Enter', ctrlKey: true});
  fireEvent.keyDown(field, {key: 'Escape', shiftKey: true});
  expect(f.edit).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(field, {key: 'Enter'});
  await waitFor(() => expect(f.edit).toHaveBeenCalledTimes(2));
  expect(within(popup).getByRole('option', {name: '찬양 모음'})).toBeDefined();
});

it.each([
  {key: 'Enter', name: '새 이름', writes: 1},
  {key: 'Escape', name: '주일', writes: 0},
])(
  'restores row focus and popup navigation after rename $key',
  async ({key, name, writes}) => {
    const f = setup();
    const popup = await open();
    fireEvent.contextMenu(within(popup).getByRole('option', {name: '주일'}));
    fireEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const field = await screen.findByRole('textbox', {name: '모음 이름'});
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, {target: {value: '새 이름'}});
    fireEvent.keyDown(field, {key});
    const row = await within(popup).findByRole('option', {name});
    expect(document.activeElement).toBe(row);
    expect(screen.queryByRole('textbox', {name: '모음 이름'})).toBeNull();
    expect(f.edit).toHaveBeenCalledTimes(writes);
    fireEvent.keyDown(row, {key: 'ArrowDown'});
    const next = within(popup).getByRole('option', {name: '평일'});
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, {key: 'Escape'});
    expect(screen.queryByRole('dialog', {name: '매크로 모음'})).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '매크로 모음'}),
    );
  },
);

it('saves row order and rejects a foreign drag without moving all macros', async () => {
  const f = setup();
  const popup = await open();
  const list = within(popup).getByRole('listbox');
  const source = within(list).getByRole('option', {name: '평일'});
  const target = within(list).getByRole('option', {name: '주일'});
  const dataTransfer = {setData: vi.fn(), effectAllowed: '', dropEffect: ''};
  fireEvent.drop(target, {dataTransfer});
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.dragStart(source, {dataTransfer});
  fireEvent.dragOver(target, {dataTransfer});
  expect(dataTransfer.dropEffect).toBe('move');
  fireEvent.drop(target, {dataTransfer});
  fireEvent.dragEnd(source, {dataTransfer});
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  expect(
    within(list)
      .getAllByRole('option')
      .map(row => row.textContent),
  ).toEqual(['모든 매크로', '평일', '주일']);
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.name !== 'macros') throw new Error('Missing reorder');
  expect(edit.value).toMatchObject({
    collections: [second, first],
    future: true,
  });
  fireEvent.keyDown(popup, {key: 'Escape'});
  const reopened = await open();
  expect(
    within(reopened)
      .getAllByRole('option')
      .map(row => row.textContent),
  ).toEqual(['모든 매크로', '평일', '주일']);
});

it('keeps read-only collections selectable while disabling edits', async () => {
  const f = setup(true);
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  const popup = await screen.findByRole('dialog', {name: '매크로 모음'});
  await waitFor(() =>
    expect(within(popup).getByRole('option', {name: '주일'})).toBeDefined(),
  );
  expect(
    screen
      .getByRole('button', {name: '새 매크로 모음'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  const row = within(popup).getByRole('option', {name: '주일'});
  expect(row.getAttribute('draggable')).toBe('false');
  fireEvent.contextMenu(row);
  for (const item of screen.getAllByRole('menuitem')) {
    expect(item.getAttribute('aria-disabled')).toBe('true');
  }
  fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
  fireEvent.click(row);
  expect(
    screen.getByRole('button', {name: '매크로 모음'}).textContent,
  ).toContain('주일');
  expect(f.edit).not.toHaveBeenCalled();
});
