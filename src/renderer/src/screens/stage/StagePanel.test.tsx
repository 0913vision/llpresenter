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
import {emptyLiveState} from '@shared/live';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import {useScreensSelection} from '../selection';
import {
  settingsDocument,
  looksDocument,
  screensDocument,
  LAYOUT_ID,
} from '../testing/documents';
import {StagePanel} from './StagePanel';

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  vi.restoreAllMocks();
  resetTooltips();
});
function setup({
  access = 'editable',
  count = 2,
  saving = Promise.resolve(),
}: {
  access?: 'editable' | 'readOnly';
  count?: number;
  saving?: Promise<void>;
} = {}) {
  const make = (value: object, revision = 1) => {
    const document = settingsDocument('stage-layouts', value, revision);
    if (document.name !== 'stage-layouts') throw new Error('Wrong document');
    return {...document, access};
  };
  let current = make({
    format: 'llsettings.stage',
    layouts: Array.from({length: count}, (_, index) => ({
      id:
        index === 0
          ? LAYOUT_ID
          : `00000000-0000-4000-8000-${String(index + 500).padStart(12, '0')}`,
      name: index === 0 ? 'Source' : `Other ${index}`,
      width: 1920,
      height: 1080,
      elements: [],
      future: 'keep',
    })),
  });
  const listeners = new Set<(value: SettingsDocument) => void>();
  const edit = vi.fn(async (change: SettingsEdit) => {
    if (change.type !== 'settings.update' || change.name !== 'stage-layouts') {
      throw new Error('Wrong edit');
    }
    await saving;
    current = make(change.value, current.revision + 1);
    for (const listener of listeners) listener(current);
    return {
      ok: true as const,
      value: {id: 'stage-layouts', revision: current.revision},
    };
  });
  const send = vi.fn();
  window.llp = fakeLlpApi({
    live: {send},
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'stage-layouts'
            ? current
            : name === 'looks'
              ? looksDocument()
              : screensDocument(),
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
  useLive.setState({state: emptyLiveState()});
  useScreensSelection.getState().select('stage', LAYOUT_ID);
  const view = render(<StagePanel onProblem={vi.fn()} />);
  return {view, edit, send, current: () => current, user: userEvent.setup()};
}
async function menu(name = 'Source') {
  fireEvent.contextMenu(await screen.findByRole('option', {name}));
  await screen.findByRole('menu', {name: '무대 배치 메뉴'});
}

it('duplicates and selects a layout without changing live output', async () => {
  const {current, user, send} = setup();
  await menu();
  await user.click(screen.getByRole('menuitem', {name: '복제'}));
  const copied = await screen.findByRole('option', {
    name: 'Source 복사본',
    selected: true,
  });
  expect(copied.getAttribute('data-value')).not.toBe(LAYOUT_ID);
  expect(current().value.layouts.at(-1)).toMatchObject({
    future: 'keep',
    width: 1920,
  });
  expect(send).not.toHaveBeenCalled();
});

it('focuses rename, restores invalid drafts on blur and cancels composing input', async () => {
  const {current, edit, user} = setup();
  await menu();
  await user.click(screen.getByRole('menuitem', {name: '이름 변경'}));
  const input = await screen.findByRole('textbox', {name: 'Source 이름'});
  await waitFor(() => expect(document.activeElement).toBe(input));
  await user.clear(input);
  await user.type(input, 'Other 1');
  fireEvent.keyDown(input, {key: 'Enter'});
  expect(screen.getByRole('textbox')).toBe(input);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, {key: 'Escape', isComposing: true});
  expect(screen.getByRole('textbox')).toBe(input);
  fireEvent.blur(input);
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByRole('option', {name: 'Source'})).toBeDefined();
  expect(edit).not.toHaveBeenCalled();
  await menu();
  await user.click(screen.getByRole('menuitem', {name: '이름 변경'}));
  const cancelled = await screen.findByRole('textbox', {name: 'Source 이름'});
  fireEvent.change(cancelled, {target: {value: 'Other 1'}});
  fireEvent.keyDown(cancelled, {key: 'Escape'});
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(edit).not.toHaveBeenCalled();
  await menu();
  await user.click(screen.getByRole('menuitem', {name: '이름 변경'}));
  const valid = await screen.findByRole('textbox', {name: 'Source 이름'});
  fireEvent.change(valid, {target: {value: '  Renamed  '}});
  fireEvent.keyDown(valid, {key: 'Enter', isComposing: true});
  expect(edit).not.toHaveBeenCalled();
  fireEvent.keyDown(valid, {key: 'Enter'});
  await waitFor(() => expect(current().value.layouts[0]?.name).toBe('Renamed'));
});

it('does not steal a newer selection when a delayed copy finishes', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {current, edit, user} = setup({saving});
  await menu();
  await user.click(screen.getByRole('menuitem', {name: '복제'}));
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
  act(() => useScreensSelection.getState().select('screen', 'newer'));
  await act(async () => {
    release();
    await saving;
  });
  await waitFor(() => expect(current().value.layouts).toHaveLength(3));
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'screen',
    id: 'newer',
  });
});

it('keeps future-version menus read-only and leaves rename available at the copy cap', async () => {
  const readOnly = setup({access: 'readOnly'});
  await menu();
  expect(
    screen.getByRole('menuitem', {name: '복제'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen
      .getByRole('menuitem', {name: '이름 변경'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  readOnly.view.unmount();
  setup({count: 1000});
  await menu();
  expect(
    screen.getByRole('menuitem', {name: '복제'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen
      .getByRole('menuitem', {name: '이름 변경'})
      .getAttribute('aria-disabled'),
  ).toBeNull();
});
