import {
  act,
  fireEvent,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import type {EditResult} from '@shared/schema/contentEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {ScreenList} from './ScreenList';
import {useScreensSelection} from './selection';
import {
  MAIN_ID,
  CAPTIONS_ID,
  STAGE_ID,
  screensDocument,
  settingsDocument,
} from './testing/documents';

const CREATED_ID = '00000000-0000-4000-8000-000000000201';

function setup(
  initial: SettingsDocument = screensDocument(),
  held?: Promise<void>,
) {
  let document = initial;
  const listeners = new Set<(next: SettingsDocument) => void>();
  const send = vi.fn();
  const edit = vi.fn<(request: SettingsEdit) => Promise<EditResult>>(
    async request => {
      await held;
      if (request.name !== 'screens' || document.name !== 'screens') {
        throw new Error('Unexpected edit');
      }
      document = {
        ...document,
        revision: document.revision + 1,
        value: request.value,
      };
      for (const listener of listeners) listener(document);
      return {ok: true, value: {id: 'screens', revision: document.revision}};
    },
  );
  window.llp = fakeLlpApi({
    live: {send},
    settings: {
      get: () => Promise.resolve(document),
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
  const view = render(<ScreenList />);
  return {edit, send, view};
}

async function add(label: string, method: string) {
  const button = await screen.findByRole('button', {name: `새 ${label} 화면`});
  await waitFor(() =>
    expect(button.getAttribute('aria-disabled')).not.toBe('true'),
  );
  await userEvent.click(button);
  await userEvent.click(
    within(screen.getByRole('menu', {name: `${label} 화면 추가`})).getByRole(
      'menuitem',
      {name: method},
    ),
  );
}

beforeEach(() => {
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(CREATED_ID);
});
afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  resetTooltips();
  vi.restoreAllMocks();
});

describe('screen creation and group outputs', () => {
  it.each([
    {draft: '', reason: '이름이 비어 있음'},
    {draft: '방송 자막', reason: '같은 이름의 화면이 있음'},
  ])(
    'shows inline draft validation for $reason before committing',
    async ({draft, reason}) => {
      const {edit} = setup();
      fireEvent.contextMenu(
        await screen.findByRole('option', {name: '본 화면'}),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', {name: '이름 변경'}),
      );
      const field = await screen.findByRole('textbox', {name: '본 화면 이름'});
      await userEvent.clear(field);
      if (draft !== '') await userEvent.type(field, draft);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      await hoverForTooltip(field);
      expect(screen.getByRole('tooltip').textContent).toBe(reason);
      resetTooltips();
      vi.useRealTimers();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('textbox', {name: '본 화면 이름'})).toBe(field);
      expect(edit).not.toHaveBeenCalled();
      await userEvent.clear(field);
      await userEvent.type(field, '고친 이름');
      expect(field.getAttribute('aria-invalid')).toBeNull();
      await userEvent.keyboard('{Enter}');
      await screen.findByRole('option', {name: '고친 이름'});
      expect(edit).toHaveBeenCalledOnce();
    },
  );

  it.each(['', '방송 자막'])(
    'restores the saved name on blur after invalid draft %j',
    async draft => {
      const {edit} = setup();
      fireEvent.contextMenu(
        await screen.findByRole('option', {name: '본 화면'}),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', {name: '이름 변경'}),
      );
      const field = await screen.findByRole('textbox', {name: '본 화면 이름'});
      await userEvent.clear(field);
      if (draft !== '') await userEvent.type(field, draft);
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('textbox', {name: '본 화면 이름'})).toBe(field);
      expect(edit).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('option', {name: '무대 화면'}));
      expect(screen.queryByRole('textbox', {name: '본 화면 이름'})).toBeNull();
      expect(screen.getByRole('option', {name: '본 화면'})).toBeDefined();
      expect(edit).not.toHaveBeenCalled();
    },
  );

  it('hands focused keyboard-menu rename off after cleanup and saves only once', async () => {
    const {edit} = setup();
    const row = await screen.findByRole('option', {name: '본 화면'});
    row.focus();
    fireEvent.keyDown(row, {key: 'ContextMenu'});
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '이름 변경'}),
    );
    const field = await screen.findByRole('textbox', {name: '본 화면 이름'});
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(edit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Control>}a{/Control}새 이름{Enter}');
    await screen.findByRole('option', {name: '새 이름'});
    expect(edit).toHaveBeenCalledOnce();
  });

  it('cancels deletion without a write and then removes only the confirmed screen', async () => {
    const {edit, send} = setup();
    const row = await screen.findByRole('option', {name: '본 화면'});
    await userEvent.click(row);
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    const first = await screen.findByRole('alertdialog');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(first).getByRole('button', {name: '삭제'}),
      ),
    );
    await userEvent.click(within(first).getByRole('button', {name: '취소'}));
    expect(edit).not.toHaveBeenCalled();
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('option', {name: '본 화면'})).toBeNull(),
    );
    expect(
      (await screen.findByRole('option', {name: '방송 자막'})).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
    const request = edit.mock.calls[0]?.[0];
    if (request?.name !== 'screens') throw new Error('Missing removal');
    expect(request.value.screens.map(screen => screen.id)).toEqual([
      CAPTIONS_ID,
      STAGE_ID,
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it('disables row lifecycle actions in read-only settings', async () => {
    const {edit} = setup({...screensDocument(), access: 'readOnly'});
    fireEvent.contextMenu(await screen.findByRole('option', {name: '본 화면'}));
    const rename = await screen.findByRole('menuitem', {name: '이름 변경'});
    expect(rename.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen
        .getByRole('menuitem', {name: '삭제'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await userEvent.click(rename);
    expect(edit).not.toHaveBeenCalled();
  });

  it('disables creation at the shared screen limit', async () => {
    const screens = Array.from({length: 200}, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `Screen ${index}`,
      kind: 'audience',
      method: 'window',
    }));
    const {edit} = setup(settingsDocument('screens', {screens}));
    await screen.findByRole('option', {name: 'Screen 199'});
    const button = screen.getByRole('button', {name: '새 청중 화면'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(edit).not.toHaveBeenCalled();
  });

  it('keeps non-System outputs outside the group toggle', async () => {
    const {send} = setup(
      settingsDocument('screens', {
        screens: [
          {id: MAIN_ID, name: 'Local', kind: 'audience', method: 'window'},
          {id: CAPTIONS_ID, name: 'Network', kind: 'audience', method: 'ndi'},
        ],
      }),
    );
    await screen.findByRole('option', {name: 'Local'});
    await userEvent.click(screen.getByRole('button', {name: '청중 출력'}));
    expect(send).toHaveBeenLastCalledWith({
      type: 'live.batch',
      commands: [{type: 'output.set', screenId: MAIN_ID, on: true}],
    });
  });
  it('adds an unassigned Audience screen, selects it, and leaves output off', async () => {
    const {edit, send} = setup();
    await add('청중', '전체 화면');
    expect(
      (await screen.findByRole('option', {name: '새 청중 화면'})).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
    const request = edit.mock.calls[0]?.[0];
    if (request?.name !== 'screens') throw new Error('Missing screen creation');
    expect(request.value.screens.at(-1)).toMatchObject({
      id: CREATED_ID,
      kind: 'audience',
      method: 'fullscreen',
      alwaysOnTop: false,
    });
    expect(request.value.screens.at(-1)?.display).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('adds a Stage capture screen with the explicit output defaults', async () => {
    const {edit} = setup();
    await add('무대', '캡처 창');
    await screen.findByRole('option', {name: '새 무대 화면'});
    const request = edit.mock.calls[0]?.[0];
    if (request?.name !== 'screens') throw new Error('Missing screen creation');
    expect(request.value.screens.at(-1)).toMatchObject({
      kind: 'stage',
      method: 'capture',
      resolution: {width: 1920, height: 1080},
      alwaysOnTop: false,
    });
  });

  it('keeps empty groups usable and disables their output switch', async () => {
    const {send} = setup(settingsDocument('screens', {screens: []}));
    await add('무대', '창');
    await screen.findByRole('option', {name: '새 무대 화면'});
    expect(screen.getByRole('group', {name: '청중'})).toBeDefined();
    expect(
      screen
        .getByRole('button', {name: '청중 출력'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(send).not.toHaveBeenCalled();
  });

  it('does not write from a read-only creation button and explains why', async () => {
    const {edit} = setup({...screensDocument(), access: 'readOnly'});
    await screen.findByRole('option', {name: '본 화면'});
    const button = screen.getByRole('button', {name: '새 청중 화면'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    await hoverForTooltip(button);
    expect(screen.getByRole('tooltip').textContent).toContain(
      '새 버전에서 만든 설정',
    );
    expect(edit).not.toHaveBeenCalled();
  });

  it('opens from the keyboard without moving row selection and restores opener focus', async () => {
    setup();
    await screen.findByRole('option', {name: '본 화면'});
    const button = screen.getByRole('button', {name: '새 청중 화면'});
    const before = useScreensSelection.getState().selection;
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', {name: '청중 화면 추가'})).toBeDefined();
    expect(useScreensSelection.getState().selection).toBe(before);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(button);
  });

  it('enables or disables only the System outputs of the selected group atomically', async () => {
    const {send, edit} = setup();
    await screen.findByRole('option', {name: '본 화면'});
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), outputs: {[MAIN_ID]: true}},
      }),
    );
    const button = screen.getByRole('button', {name: '청중 출력'});
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(button);
    expect(send).toHaveBeenLastCalledWith({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: MAIN_ID, on: false},
        {type: 'output.set', screenId: CAPTIONS_ID, on: false},
      ],
    });
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), outputs: {[STAGE_ID]: true}},
      }),
    );
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(button);
    expect(send).toHaveBeenLastCalledWith({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: MAIN_ID, on: true},
        {type: 'output.set', screenId: CAPTIONS_ID, on: true},
      ],
    });
    expect(edit).not.toHaveBeenCalled();
  });

  it('preserves a selection made while creation is waiting for the save', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const {edit} = setup(screensDocument(), held);
    await add('청중', '창');
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('option', {name: '무대 화면'}));
    await act(async () => {
      release();
      await held;
    });
    await screen.findByRole('option', {name: '새 청중 화면'});
    expect(useScreensSelection.getState().selection).toEqual({
      kind: 'screen',
      id: STAGE_ID,
    });
  });

  it('does not select a created screen after its workspace unmounts', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const {edit, view} = setup(screensDocument(), held);
    await add('청중', '창');
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    const previous = useScreensSelection.getState().selection;
    view.unmount();
    await act(async () => {
      release();
      await held;
    });
    expect(useScreensSelection.getState().selection).toBe(previous);
  });
});
