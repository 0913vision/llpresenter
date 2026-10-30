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
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {useLive} from '@renderer/session/live';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import {useScreensSelection} from '../selection';
import {
  settingsDocument,
  looksDocument,
  screensDocument,
  LAYOUT_ID,
  LOOK_ID,
  STAGE_ID,
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
  lookDocument = looksDocument(),
  refuse = false,
}: {
  access?: 'editable' | 'readOnly';
  count?: number;
  saving?: Promise<void>;
  lookDocument?: SettingsDocument | Promise<SettingsDocument>;
  refuse?: boolean;
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
    if (refuse) {
      return {
        ok: false as const,
        error: {reason: 'invalid' as const, message: 'Layout is in use'},
      };
    }
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
              ? lookDocument
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
  const onProblem = vi.fn();
  const view = render(<StagePanel onProblem={onProblem} />);
  return {
    view,
    edit,
    send,
    onProblem,
    current: () => current,
    user: userEvent.setup(),
  };
}
async function menu(name = 'Source') {
  fireEvent.contextMenu(await screen.findByRole('option', {name}));
  await screen.findByRole('menu', {name: '무대 배치 메뉴'});
}
async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('menuitem', {name: '삭제'}));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', {name: '삭제'}));
}

it('lists the stage layout menu rows in spec order without icons', async () => {
  setup();
  await menu();
  const surface = screen.getByRole('menu', {name: '무대 배치 메뉴'});
  expect(
    [...surface.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
      row => (row.getAttribute('role') === 'separator' ? '|' : row.textContent),
    ),
  ).toEqual(['복제', '이름 바꾸기', '|', '삭제']);
  expect(surface.querySelector('svg')).toBeNull();
});

it('asks about the named layout and leaves it intact on cancel', async () => {
  const {current, edit, user} = setup();
  await menu('Other 1');
  await user.click(screen.getByRole('menuitem', {name: '삭제'}));
  const dialog = await screen.findByRole('alertdialog', {
    name: '‘Other 1’ 배치를 삭제할까요?',
  });
  expect(edit).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(current().value.layouts).toHaveLength(2);
  expect(edit).not.toHaveBeenCalled();
});

it('disables deletion of layouts used by current or inactive Looks', async () => {
  const original = looksDocument();
  if (original.name !== 'looks') throw new Error('Missing Looks');
  const otherId = '00000000-0000-4000-8000-000000000501';
  const lookDocument = settingsDocument('looks', {
    ...original.value,
    looks: original.value.looks.map((look, index) =>
      index !== 1
        ? look
        : {
            ...look,
            screens: {
              ...look.screens,
              [STAGE_ID]: {layers: {}, stageLayout: otherId},
            },
          },
    ),
  });
  const {edit, user} = setup({lookDocument});
  for (const name of ['Source', 'Other 1']) {
    await menu(name);
    const remove = screen.getByRole('menuitem', {name: '삭제'});
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    await user.click(remove);
    expect(edit).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
  }
});

it('keeps deletion disabled until Look references are available', async () => {
  const lookDocument = new Promise<SettingsDocument>(() => undefined);
  const {edit, user} = setup({lookDocument});
  await menu('Other 1');
  const remove = screen.getByRole('menuitem', {name: '삭제'});
  expect(remove.getAttribute('aria-disabled')).toBe('true');
  await user.click(remove);
  expect(edit).not.toHaveBeenCalled();
});

it('deletes an unused selected layout and selects its surviving neighbour', async () => {
  const {current, user, send} = setup();
  await user.click(await screen.findByRole('option', {name: 'Other 1'}));
  await menu('Other 1');
  await confirmDelete(user);
  await waitFor(() => expect(current().value.layouts).toHaveLength(1));
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'stage',
    id: LAYOUT_ID,
  });
  expect(send).not.toHaveBeenCalled();
});

it('clears the stage selection after deleting the last unreferenced layout', async () => {
  const lookDocument = settingsDocument('looks', {
    current: LOOK_ID,
    looks: [{id: LOOK_ID, name: 'Plain', screens: {}}],
    lyricStyles: [],
  });
  const {current, user} = setup({count: 1, lookDocument});
  useScreensSelection.setState({lastScreenId: null});
  useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'element');
  await menu();
  await confirmDelete(user);
  await waitFor(() => expect(current().value.layouts).toHaveLength(0));
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'screen',
    id: null,
  });
  expect(useScreensSelection.getState().stageElement).toBeNull();
});

it('does not replace a newer selection when a delayed removal completes', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {current, edit, user} = setup({saving});
  await user.click(await screen.findByRole('option', {name: 'Other 1'}));
  await menu('Other 1');
  await confirmDelete(user);
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
  act(() => useScreensSelection.getState().select('screen', 'newer'));
  await act(async () => {
    release();
    await saving;
  });
  await waitFor(() => expect(current().value.layouts).toHaveLength(1));
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'screen',
    id: 'newer',
  });
});

it('keeps selection and reports a backend refusal if a Look assignment wins a race', async () => {
  const {current, edit, onProblem, user} = setup({refuse: true});
  await user.click(await screen.findByRole('option', {name: 'Other 1'}));
  await menu('Other 1');
  await confirmDelete(user);
  await waitFor(() => expect(onProblem).toHaveBeenCalled());
  expect(edit).toHaveBeenCalledOnce();
  expect(current().value.layouts).toHaveLength(2);
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'stage',
    id: '00000000-0000-4000-8000-000000000501',
  });
});

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
  await user.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
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
  await user.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
  const cancelled = await screen.findByRole('textbox', {name: 'Source 이름'});
  fireEvent.change(cancelled, {target: {value: 'Other 1'}});
  fireEvent.keyDown(cancelled, {key: 'Escape'});
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(edit).not.toHaveBeenCalled();
  await menu();
  await user.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
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
      .getByRole('menuitem', {name: '이름 바꾸기'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen.getByRole('menuitem', {name: '삭제'}).getAttribute('aria-disabled'),
  ).toBe('true');
  readOnly.view.unmount();
  setup({count: 1000});
  await menu();
  expect(
    screen.getByRole('menuitem', {name: '복제'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    screen
      .getByRole('menuitem', {name: '이름 바꾸기'})
      .getAttribute('aria-disabled'),
  ).toBeNull();
});
