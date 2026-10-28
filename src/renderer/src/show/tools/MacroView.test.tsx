import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {MacroView} from './MacroView';

const parsed = parseSettingsDocument({
  name: 'macros',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llsettings.macros',
    schemaVersion: 1,
    macros: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: '시작',
        icon: 'star',
        color: 'teal',
        actions: [],
        runOnStartup: true,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: '마침',
        icon: 'star',
        color: 'rose',
        actions: [{kind: 'clearAll'}],
      },
    ],
    collections: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: '주일',
        macroIds: ['00000000-0000-4000-8000-000000000002'],
      },
    ],
  },
});
if (!parsed.ok || parsed.value.name !== 'macros') {
  throw new Error('Invalid fixture');
}
const {macros, collections} = parsed.value.value;
const first = macros[0];
const second = macros[1];
const group = collections[0];
if (!first || !second || !group) throw new Error('Missing fixture');
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('moves keyboard focus without running and activates the chosen macro', () => {
  const run = vi.fn();
  const menu = vi.fn();
  const add = vi.fn();
  render(
    <MacroView
      macros={macros}
      collections={collections}
      collectionId={undefined}
      mode="grid"
      lastRunId={first.id}
      onCollection={() => undefined}
      onMode={() => undefined}
      onRun={run}
      onMenu={menu}
      onNew={add}
    />,
  );
  const list = screen.getByRole('listbox', {name: '매크로'});
  const start = within(list).getByRole('option', {name: /시작/});
  const end = within(list).getByRole('option', {name: '마침'});
  expect(start.getAttribute('data-state')).toBe('last-run');
  start.focus();
  fireEvent.keyDown(start, {key: 'ArrowRight'});
  expect(document.activeElement).toBe(end);
  expect(run).not.toHaveBeenCalled();
  fireEvent.keyDown(end, {key: 'Enter'});
  expect(run).toHaveBeenCalledExactlyOnceWith(second);
  fireEvent.keyDown(end, {key: 'ContextMenu'});
  expect(menu).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', {name: '새 매크로'}));
  expect(add).toHaveBeenCalledOnce();
});

it('shows the chosen collection in list mode with its action count', () => {
  const run = vi.fn();
  const collection = vi.fn();
  const mode = vi.fn();
  render(
    <MacroView
      macros={macros}
      collections={collections}
      collectionId={group.id}
      mode="list"
      selectedId={second.id}
      onCollection={collection}
      onMode={mode}
      onRun={run}
      onMenu={() => undefined}
      onNew={() => undefined}
    />,
  );
  expect(screen.getByText('1개')).toBeDefined();
  expect(screen.queryByRole('option', {name: /시작/})).toBeNull();
  const row = screen.getByRole('option', {name: '마침'});
  expect(row.getAttribute('aria-selected')).toBe('true');
  expect(row.textContent).toContain('동작 1개');
  fireEvent.click(row);
  expect(run).toHaveBeenCalledExactlyOnceWith(second);
  fireEvent.click(screen.getByRole('button', {name: '격자 보기'}));
  expect(mode).toHaveBeenCalledWith('grid');
  fireEvent.click(screen.getByRole('button', {name: '매크로 모음'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '모든 매크로'}));
  expect(collection).toHaveBeenCalledWith(undefined);
});
