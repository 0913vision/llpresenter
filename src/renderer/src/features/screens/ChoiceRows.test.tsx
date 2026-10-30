import {useState} from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import type {GroupRename} from '@renderer/ui/ListRow';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {ChoiceRows} from './ChoiceRows';
import type {Choice} from './choices';

const observers = new Set<ResizeObserver>();
beforeEach(() => {
  document.documentElement.style.setProperty('--size-row', '28px');
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(84);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {
        observers.add(this);
      }
      observe() {
        this.callback([], this);
      }
      unobserve() {}
      disconnect() {
        observers.delete(this);
      }
    },
  );
});
afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--size-row');
  observers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup({
  onMenu,
  renaming = null,
  warnings,
}: {
  onMenu?: (choice: Choice, anchor: MenuAnchor) => void;
  renaming?: {id: string; handlers: GroupRename} | null;
  warnings?: ReadonlyMap<string, string>;
} = {}) {
  const choices = Array.from({length: 1000}, (_, index) => ({
    id: `layout-${index}`,
    name: `Layout ${index}`,
  }));
  const select = vi.fn();
  function List() {
    const [selected, setSelected] = useState(choices[0]?.id);
    return (
      <ChoiceRows
        choices={choices}
        selected={selected}
        inUse={new Set(['layout-0', 'layout-1', 'layout-999'])}
        label="Stage layouts"
        renaming={renaming}
        {...(warnings === undefined ? {} : {warnings})}
        {...(onMenu === undefined ? {} : {onMenu})}
        onSelect={id => {
          select(id);
          setSelected(id);
        }}
      />
    );
  }
  return {...render(<List />), select};
}

it('bounds a thousand rows while Home and End select and focus the full model', async () => {
  const view = setup();
  expect(screen.getAllByRole('option').length).toBeLessThan(30);
  expect(screen.getAllByText('LIVE')).toHaveLength(2);
  const first = screen.getByRole('option', {name: 'Layout 0'});
  first.focus();
  fireEvent.keyDown(first, {key: 'End'});
  const last = await screen.findByRole('option', {name: 'Layout 999'});
  expect(last.getAttribute('aria-selected')).toBe('true');
  await waitFor(() => expect(document.activeElement).toBe(last));
  expect(view.select).toHaveBeenLastCalledWith('layout-999');
  expect(screen.getAllByRole('option').length).toBeLessThan(30);
  expect(screen.getAllByText('LIVE')).toHaveLength(1);
  fireEvent.keyDown(last, {key: 'Home'});
  const restored = await screen.findByRole('option', {name: 'Layout 0'});
  await waitFor(() => expect(document.activeElement).toBe(restored));
  view.unmount();
  expect(observers.size).toBe(0);
});

it('keeps each warning on its matching row when the list is windowed', async () => {
  setup({
    warnings: new Map([
      ['layout-1', 'Missing font'],
      ['layout-999', 'Other missing font'],
    ]),
  });
  const first = screen.getByRole('option', {name: 'Layout 1'});
  expect(within(first).getByRole('img', {name: 'Missing font'})).toBeDefined();
  expect(first.dataset['state']).toContain('warning');
  const zero = screen.getByRole('option', {name: 'Layout 0'});
  expect(within(zero).queryByRole('img')).toBeNull();
  zero.focus();
  fireEvent.keyDown(zero, {key: 'End'});
  const last = await screen.findByRole('option', {name: 'Layout 999'});
  expect(
    within(last).getByRole('img', {name: 'Other missing font'}),
  ).toBeDefined();
  expect(last.dataset['state']).toContain('warning');
});

it('navigates from the focused row after tabbing back into a scrolled list', async () => {
  const choices = Array.from({length: 1000}, (_, index) => ({
    id: `layout-${index}`,
    name: `Layout ${index}`,
  }));
  const select = vi.fn();
  function Workspace() {
    const [selected, setSelected] = useState<string | undefined>(
      choices[0]?.id,
    );
    return (
      <>
        <button onClick={() => setSelected(undefined)}>Other panel</button>
        <ChoiceRows
          choices={choices}
          selected={selected}
          inUse={new Set()}
          label="Stage layouts"
          renaming={null}
          onSelect={id => {
            select(id);
            setSelected(id);
          }}
        />
      </>
    );
  }
  render(<Workspace />);
  const viewport = screen.getByRole('listbox').parentElement;
  if (!(viewport instanceof HTMLElement)) throw new Error('Missing viewport');
  viewport.scrollTop = 990 * 28;
  fireEvent.scroll(viewport);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name: 'Other panel'}));
  await user.tab();
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement)) throw new Error('Missing focused row');
  const index = Number(focused.dataset['value']?.replace('layout-', ''));
  expect(index).toBeGreaterThan(980);
  expect(index).toBeLessThan(999);
  await user.keyboard('{ArrowDown}');
  await waitFor(() =>
    expect(select).toHaveBeenLastCalledWith(`layout-${index + 1}`),
  );
  await waitFor(() =>
    expect(document.activeElement?.getAttribute('data-value')).toBe(
      `layout-${index + 1}`,
    ),
  );
});

it('opens row menus with pointer and keyboard only when a menu is provided', () => {
  const plain = setup();
  expect(
    fireEvent.keyDown(screen.getByRole('option', {name: 'Layout 0'}), {
      key: 'ContextMenu',
    }),
  ).toBe(true);
  plain.unmount();
  const onMenu = vi.fn<(choice: Choice, anchor: MenuAnchor) => void>();
  setup({onMenu});
  const row = screen.getByRole('option', {name: 'Layout 0'});
  fireEvent.contextMenu(row, {clientX: 12, clientY: 34});
  expect(onMenu).toHaveBeenLastCalledWith(
    {id: 'layout-0', name: 'Layout 0'},
    {kind: 'point', point: {x: 12, y: 34}},
  );
  fireEvent.keyDown(row, {key: 'F10', shiftKey: true});
  expect(onMenu.mock.calls.at(-1)?.[1]).toMatchObject({kind: 'element'});
});

it('leaves rename keystrokes in the field and commits its draft before scrolling', async () => {
  const onCommit = vi.fn();
  const {container, select} = setup({
    renaming: {id: 'layout-0', handlers: {onCommit, onCancel: vi.fn()}},
  });
  const input = await screen.findByRole('textbox');
  input.focus();
  fireEvent.change(input, {target: {value: 'Changed'}});
  fireEvent.keyDown(input, {key: 'ArrowDown'});
  expect(select).not.toHaveBeenCalled();
  const viewport = container.firstElementChild;
  if (!(viewport instanceof HTMLElement)) throw new Error('Missing viewport');
  fireEvent.scroll(viewport);
  expect(onCommit).toHaveBeenCalledOnce();
  expect(onCommit).toHaveBeenCalledWith('Changed');
});
