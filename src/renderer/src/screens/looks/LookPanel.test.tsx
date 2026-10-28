import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {useScreensSelection} from '../selection';
import {
  LOOK_ID,
  MAIN_ID,
  SERMON_LOOK_ID,
  looksDocument,
  screensDocument,
  settingsDocument,
} from '../testing/documents';
import {LookPanel} from './LookPanel';

function setup({
  initial = looksDocument(),
  referenced = false,
  holdMacros = false,
  beforeSave = () => Promise.resolve(),
}: {
  readonly initial?: SettingsDocument;
  readonly referenced?: boolean;
  readonly holdMacros?: boolean;
  readonly beforeSave?: () => Promise<void>;
} = {}) {
  let document = initial;
  const listeners = new Set<(next: SettingsDocument) => void>();
  const macros = settingsDocument('macros', {
    collections: [],
    macros: referenced
      ? [
          {
            id: '00000000-0000-4000-8000-0000000000c1',
            name: '전환',
            icon: 'macro',
            color: 'teal',
            actions: [{kind: 'look', look: SERMON_LOOK_ID}],
          },
        ]
      : [],
  });
  let releaseMacros = (): void => undefined;
  const loading = new Promise<SettingsDocument>(resolve => {
    releaseMacros = () => resolve(macros);
  });
  const send = vi.fn();
  const edit = vi.fn(async (change: SettingsEdit) => {
    if (change.type !== 'settings.update' || change.name !== 'looks') {
      throw new Error('Unexpected edit');
    }
    await beforeSave();
    document = settingsDocument('looks', change.value, document.revision + 1);
    for (const listener of listeners) listener(document);
    return {
      ok: true,
      value: {id: 'looks', revision: document.revision},
    } as const;
  });
  const api = fakeLlpApi({
    live: {send},
    settings: {
      get: request =>
        Promise.resolve(
          request.name === 'looks'
            ? document
            : request.name === 'screens'
              ? screensDocument()
              : holdMacros
                ? loading
                : macros,
        ),
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  window.llp = api;
  const onProblem = vi.fn();
  const view = render(<LookPanel onProblem={onProblem} />);
  return {
    view,
    api,
    edit,
    send,
    onProblem,
    releaseMacros,
    listeners,
    document: () => document,
    user: userEvent.setup(),
  };
}

beforeEach(() => {
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
  useLive.setState({state: emptyLiveState()});
});

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--size-row');
  resetTooltips();
});

async function menu(name: string): Promise<void> {
  fireEvent.contextMenu(await screen.findByRole('option', {name}));
  await screen.findByRole('menu', {name: 'Look 메뉴'});
}

it('adds and duplicates without changing live output or the saved current Look', async () => {
  const {user, document, send, edit} = setup();
  await screen.findByRole('option', {name: '평상시'});
  await user.click(screen.getByRole('button', {name: '새 Look'}));
  const added = await screen.findByRole('option', {
    name: '새 Look',
    selected: true,
  });
  fireEvent.contextMenu(added);
  await user.click(await screen.findByRole('menuitem', {name: '복제'}));
  await screen.findByRole('option', {name: '새 Look 복사본', selected: true});
  expect(edit).toHaveBeenCalledTimes(2);
  expect(document().value).toHaveProperty('current', LOOK_ID);
  expect(send).not.toHaveBeenCalled();
});

it('does not replace a screen selection made while a new Look is saving', async () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const {user, edit} = setup({beforeSave: () => held});
  await screen.findByRole('option', {name: '평상시'});
  await user.click(screen.getByRole('button', {name: '새 Look'}));
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
  act(() => useScreensSelection.getState().select('screen', MAIN_ID));
  await act(async () => release());
  await screen.findByRole('option', {name: '새 Look'});
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'screen',
    id: MAIN_ID,
  });
});

it('waits for the latest queued Look creation before changing selection', async () => {
  let releaseFirst: () => void = () => undefined;
  let releaseSecond: () => void = () => undefined;
  const first = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  const second = new Promise<void>(resolve => {
    releaseSecond = resolve;
  });
  let count = 0;
  const {user, edit} = setup({
    beforeSave: () => (++count === 1 ? first : second),
  });
  await screen.findByRole('option', {name: '평상시'});
  await user.click(screen.getByRole('button', {name: '새 Look'}));
  await user.click(screen.getByRole('button', {name: '새 Look'}));
  expect(edit).toHaveBeenCalledOnce();
  await act(async () => releaseFirst());
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'screen',
    id: null,
  });
  await act(async () => releaseSecond());
  await screen.findByRole('option', {name: '새 Look 2', selected: true});
});

it('commits a focused name during close flushing', async () => {
  const {user, api, edit, onProblem} = setup();
  await menu('설교');
  await user.click(screen.getByRole('menuitem', {name: '이름 변경'}));
  const field = await screen.findByRole('textbox', {name: '설교 이름'});
  await user.clear(field);
  await user.type(field, '새 이름');
  expect(edit).not.toHaveBeenCalled();
  act(() => field.blur());
  await act(async () => {
    expect(await pendingWritesOf(api).flush()).toBe(true);
  });
  await screen.findByRole('option', {name: '새 이름'});
  expect(edit).toHaveBeenCalledOnce();
  expect(onProblem).not.toHaveBeenCalled();
});

it.each([
  {draft: '', reason: '이름이 비어 있음'},
  {draft: '평상시', reason: '같은 이름의 Look이 있음'},
])(
  'keeps invalid Look drafts open for $reason and restores them on blur',
  async ({draft, reason}) => {
    const {user, edit, onProblem} = setup();
    await menu('설교');
    await user.click(screen.getByRole('menuitem', {name: '이름 변경'}));
    const field = await screen.findByRole('textbox', {name: '설교 이름'});
    await user.clear(field);
    if (draft !== '') await user.type(field, draft);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    await hoverForTooltip(field);
    expect(screen.getByRole('tooltip').textContent).toBe(reason);
    resetTooltips();
    vi.useRealTimers();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', {name: '설교 이름'})).toBe(field);
    expect(edit).not.toHaveBeenCalled();
    expect(onProblem).not.toHaveBeenCalled();
    await user.tab();
    await waitFor(() =>
      expect(screen.queryByRole('textbox', {name: '설교 이름'})).toBeNull(),
    );
    expect(screen.getByRole('option', {name: '설교'})).toBeDefined();
    expect(edit).not.toHaveBeenCalled();
    expect(onProblem).not.toHaveBeenCalled();
  },
);

it('hands keyboard-menu focus to the rename field after the menu restores its opener', async () => {
  const {user, edit} = setup();
  const row = await screen.findByRole('option', {name: '설교'});
  act(() => row.focus());
  fireEvent.keyDown(row, {key: 'ContextMenu'});
  await screen.findByRole('menu', {name: 'Look 메뉴'});
  for (const item of screen.getAllByRole('menuitem')) {
    item.scrollIntoView = vi.fn();
  }
  await user.keyboard('{ArrowDown}{Enter}');
  const field = await screen.findByRole('textbox', {name: '설교 이름'});
  expect(document.activeElement).toBe(field);
  expect(edit).not.toHaveBeenCalled();
  await user.clear(field);
  await user.type(field, '본문용{Enter}');
  await screen.findByRole('option', {name: '본문용'});
  expect(edit).toHaveBeenCalledOnce();
});

it('protects current Looks and confirms macro references before deleting', async () => {
  const {user, edit, send} = setup({referenced: true});
  await menu('평상시');
  expect(
    screen.getByRole('menuitem', {name: '삭제'}).getAttribute('aria-disabled'),
  ).toBe('true');
  await user.keyboard('{Escape}');
  await menu('설교');
  await user.click(screen.getByRole('menuitem', {name: '삭제'}));
  const dialog = await screen.findByRole('alertdialog', {
    name: '‘설교’ Look을 삭제할까요?',
  });
  expect(within(dialog).getByText('전환')).toBeDefined();
  expect(edit).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', {name: '삭제'}));
  await waitFor(() =>
    expect(screen.queryByRole('option', {name: '설교'})).toBeNull(),
  );
  expect(edit).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});

it('keeps read-only Looks selectable while every edit command is disabled', async () => {
  const {user, edit, view, listeners} = setup({
    initial: {...looksDocument(), access: 'readOnly'},
  });
  await menu('설교');
  for (const item of screen.getAllByRole('menuitem')) {
    expect(item.getAttribute('aria-disabled')).toBe('true');
    await user.click(item);
  }
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', {name: '새 Look'}));
  await user.click(screen.getByRole('option', {name: '설교'}));
  await screen.findByRole('option', {name: '설교', selected: true});
  expect(edit).not.toHaveBeenCalled();
  view.unmount();
  expect(listeners.size).toBe(0);
});

it('waits for macro metadata before enabling deletion', async () => {
  const {user, releaseMacros} = setup({holdMacros: true});
  await menu('설교');
  expect(
    screen.getByRole('menuitem', {name: '삭제'}).getAttribute('aria-disabled'),
  ).toBe('true');
  await act(async () => releaseMacros());
  await waitFor(() =>
    expect(
      screen
        .getByRole('menuitem', {name: '삭제'})
        .getAttribute('aria-disabled'),
    ).toBeNull(),
  );
  await user.click(screen.getByRole('menuitem', {name: '삭제'}));
  await waitFor(() =>
    expect(screen.queryByRole('option', {name: '설교'})).toBeNull(),
  );
});

it('virtualizes an imported list and navigates to its last row', async () => {
  document.documentElement.style.setProperty('--size-row', '30px');
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(): void {
        this.callback();
      }
      disconnect(): void {}
    },
  );
  const before = looksDocument();
  if (before.name !== 'looks') throw new Error('Expected Looks');
  const first = before.value.looks[0];
  if (first === undefined) throw new Error('Missing Look');
  const looks = Array.from({length: 1100}, (_, index) => ({
    ...first,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `Look ${index}`,
  }));
  setup({
    initial: settingsDocument('looks', {
      ...before.value,
      current: looks[0]?.id,
      looks,
    }),
  });
  const row = await screen.findByRole('option', {name: 'Look 0'});
  expect(screen.getAllByRole('option').length).toBeLessThan(30);
  fireEvent.keyDown(row, {key: 'End'});
  const last = await screen.findByRole('option', {
    name: 'Look 1099',
    selected: true,
  });
  expect(document.activeElement).toBe(last);
  expect(
    screen.getByRole('button', {name: '새 Look'}).getAttribute('aria-disabled'),
  ).toBe('true');
});
