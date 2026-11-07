import {cleanup, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useState, type JSX} from 'react';
import type {EditResult} from '@core/schema/contentEdit';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {MenuBar} from '@renderer/app/shell/MenuBar';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {NOT_HERE} from '@renderer/app/shell/editMenuEntries';
import {NOT_YET} from '@renderer/ui/menuRows';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

const editText = vi.fn();

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.llp = mockLlpApi({window: {editText}});
});

afterEach(() => {
  resetTooltips();
  editText.mockReset();
  cleanup();
  delete window.llp;
});

function History({
  history,
  run,
}: {
  readonly history: {
    readonly undo: string | undefined;
    readonly redo: string | undefined;
  };
  readonly run: (id: string) => void;
}): JSX.Element {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useWindowShortcuts([
    {
      id: 'edit.undo',
      context: 'service',
      when: event => event.target === target,
      unavailable: () => history.undo,
      run: () => run('edit.undo'),
    },
    {
      id: 'edit.redo',
      context: 'service',
      when: event => event.target === target,
      unavailable: () => history.redo,
      run: () => run('edit.redo'),
    },
  ]);
  return (
    <>
      <button type="button" ref={setTarget}>
        list
      </button>
      <input aria-label="field" defaultValue="abc" />
    </>
  );
}

function Duplicates({
  reason,
  run,
}: {
  readonly reason: string | undefined;
  readonly run: () => void;
}): JSX.Element {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event => event.target === target,
      unavailable: () => reason,
      run,
    },
  ]);
  return (
    <button type="button" ref={setTarget}>
      list
    </button>
  );
}

async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<HTMLElement> {
  await user.click(screen.getByRole('menuitem', {name}));
  return screen.getByRole('menu', {name});
}

function rowOf(menu: HTMLElement, name: string): HTMLElement {
  return within(menu).getByRole('menuitem', {name: new RegExp(`^${name}`)});
}

function isOff(row: HTMLElement): boolean {
  return row.getAttribute('aria-disabled') === 'true';
}

async function reasonOf(row: HTMLElement): Promise<string | undefined> {
  return row.getAttribute('aria-disabled') === 'true'
    ? (await hoverForTooltip(row))?.textContent
    : undefined;
}

function ClipboardCommands({
  pasteReason,
  run,
}: {
  readonly pasteReason: string | undefined;
  readonly run: (id: string) => void;
}): JSX.Element {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useWindowShortcuts([
    {
      id: 'edit.copy',
      context: 'service',
      when: event => event.target === target,
      run: () => run('copy'),
    },
    {
      id: 'edit.paste',
      context: 'service',
      when: event => event.target === target,
      unavailable: () => pasteReason,
      run: () => run('paste'),
    },
  ]);
  return <button ref={setTarget}>clipboard list</button>;
}

describe('the 편집 menu', () => {
  it('uses the focused item clipboard commands and their availability before falling back to text editing', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    const {rerender} = render(
      <>
        <MenuBar title="" />
        <ClipboardCommands pasteReason={undefined} run={run} />
      </>,
    );
    screen.getByRole('button', {name: 'clipboard list'}).focus();
    let menu = await openMenu(user, '편집');
    expect(isOff(rowOf(menu, '복사'))).toBe(false);
    expect(isOff(rowOf(menu, '붙여넣기'))).toBe(false);
    await user.click(rowOf(menu, '복사'));
    await waitFor(() => expect(run).toHaveBeenCalledWith('copy'));
    menu = await openMenu(user, '편집');
    await user.click(rowOf(menu, '붙여넣기'));
    await waitFor(() => expect(run).toHaveBeenCalledWith('paste'));
    expect(editText).not.toHaveBeenCalled();
    rerender(
      <>
        <MenuBar title="" />
        <ClipboardCommands pasteReason="복사한 항목 없음" run={run} />
      </>,
    );
    screen.getByRole('button', {name: 'clipboard list'}).focus();
    menu = await openMenu(user, '편집');
    expect(await reasonOf(rowOf(menu, '붙여넣기'))).toBe('복사한 항목 없음');
  });

  it('shows every row, off where the focused place cannot do it', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    const menu = await openMenu(user, '편집');
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map(row => row.textContent);
    expect(labels).toEqual([
      '실행 취소Ctrl Z',
      '다시 실행Ctrl Y',
      '잘라내기Ctrl X',
      '복사Ctrl C',
      '텍스트 스타일 복사Ctrl Alt C',
      '붙여넣기Ctrl V',
      '텍스트 스타일 붙여넣기Alt Shift V',
      '스타일 맞춰 붙여넣기Alt V',
      '복제Ctrl D',
      '삭제Delete',
      '모두 선택Ctrl A',
      '선택 해제Ctrl Shift D',
      '찾기Ctrl F',
      '단축키…',
    ]);
    expect(await reasonOf(rowOf(menu, '실행 취소'))).toBe(NOTHING_TO_UNDO);
    expect(await reasonOf(rowOf(menu, '다시 실행'))).toBe(NOTHING_TO_REDO);
    expect(await reasonOf(rowOf(menu, '복사'))).toBe(
      '글자 입력란에서만 쓸 수 있습니다',
    );
    expect(await reasonOf(rowOf(menu, '텍스트 스타일 복사'))).toBe(NOT_YET);
    expect(isOff(rowOf(menu, '단축키…'))).toBe(false);
    expect(await reasonOf(rowOf(menu, '복제'))).toBe(NOT_HERE);
  });

  it('opens 환경설정 at its 단축키 page', async () => {
    const openPreferencesAt = vi.fn();
    window.llp = mockLlpApi({window: {openPreferencesAt}});
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    const menu = await openMenu(user, '편집');
    await user.click(rowOf(menu, '단축키…'));
    expect(openPreferencesAt).toHaveBeenCalledExactlyOnceWith('shortcuts');
  });

  it('runs 복제 through the handler of the focused list, shows its key while off, and gives the list its own reason', async () => {
    const run = vi.fn();
    const user = userEvent.setup();
    const {rerender} = render(
      <>
        <MenuBar title="" />
        <Duplicates reason={undefined} run={run} />
      </>,
    );
    screen.getByRole('button', {name: 'list'}).focus();
    let menu = await openMenu(user, '편집');
    expect(rowOf(menu, '복제').textContent).toBe('복제Ctrl D');
    expect(isOff(rowOf(menu, '복제'))).toBe(false);
    await user.click(rowOf(menu, '복제'));
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    rerender(
      <>
        <MenuBar title="" />
        <Duplicates reason="테마는 200개까지 추가할 수 있습니다" run={run} />
      </>,
    );
    screen.getByRole('button', {name: 'list'}).focus();
    menu = await openMenu(user, '편집');
    expect(rowOf(menu, '복제').textContent).toBe('복제Ctrl D');
    expect(await reasonOf(rowOf(menu, '복제'))).toBe(
      '테마는 200개까지 추가할 수 있습니다',
    );
  });

  it('runs 실행 취소 through the handler of the place that had focus', async () => {
    const run = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <MenuBar title="" />
        <History history={{undo: undefined, redo: NOTHING_TO_REDO}} run={run} />
      </>,
    );
    screen.getByRole('button', {name: 'list'}).focus();
    const menu = await openMenu(user, '편집');
    expect(isOff(rowOf(menu, '실행 취소'))).toBe(false);
    expect(isOff(rowOf(menu, '다시 실행'))).toBe(true);
    await user.click(rowOf(menu, '실행 취소'));
    await waitFor(() =>
      expect(run).toHaveBeenCalledExactlyOnceWith('edit.undo'),
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: 'list'}),
    );
    await user.keyboard('{Control>}z{/Control}');
    expect(run.mock.calls).toEqual([['edit.undo'], ['edit.undo']]);
  });

  it('disables 실행 취소 with the reason the handler gives', async () => {
    const user = userEvent.setup();
    render(
      <>
        <MenuBar title="" />
        <History
          history={{undo: NOTHING_TO_UNDO, redo: undefined}}
          run={vi.fn()}
        />
      </>,
    );
    screen.getByRole('button', {name: 'list'}).focus();
    const menu = await openMenu(user, '편집');
    expect(await reasonOf(rowOf(menu, '실행 취소'))).toBe(NOTHING_TO_UNDO);
    expect(await reasonOf(rowOf(menu, '다시 실행'))).toBeUndefined();
  });

  it('edits the text field that had focus, and needs a selection to cut or copy', async () => {
    const user = userEvent.setup();
    render(
      <>
        <MenuBar title="" />
        <History history={{undo: undefined, redo: undefined}} run={vi.fn()} />
      </>,
    );
    const field = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'field',
    });
    field.focus();
    field.setSelectionRange(1, 1);
    let menu = await openMenu(user, '편집');
    expect(isOff(rowOf(menu, '복사'))).toBe(true);
    expect(isOff(rowOf(menu, '붙여넣기'))).toBe(false);
    await user.keyboard('{Escape}');
    field.focus();
    field.setSelectionRange(0, 2);
    menu = await openMenu(user, '편집');
    expect(isOff(rowOf(menu, '복사'))).toBe(false);
    await user.click(rowOf(menu, '복사'));
    await waitFor(() => expect(editText).toHaveBeenCalledWith('copy'));
    menu = await openMenu(user, '편집');
    await user.click(rowOf(menu, '모두 선택'));
    await waitFor(() => expect(editText).toHaveBeenCalledWith('selectAll'));
  });
});

describe('the 창 menu', () => {
  it('runs the title bar actions and opens 환경설정', async () => {
    const control = vi.fn();
    const openPreferences = vi.fn();
    window.llp = mockLlpApi({window: {control, openPreferences}});
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    let menu = await openMenu(user, '창');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(row => row.textContent),
    ).toEqual(['최소화', '최대화', '환경설정…']);
    await user.click(rowOf(menu, '최소화'));
    expect(control).toHaveBeenLastCalledWith('minimize');
    menu = await openMenu(user, '창');
    await user.click(rowOf(menu, '최대화'));
    expect(control).toHaveBeenLastCalledWith('toggle-maximize');
    menu = await openMenu(user, '창');
    await user.click(rowOf(menu, '환경설정…'));
    expect(openPreferences).toHaveBeenCalledOnce();
  });
});

describe('the 도움말 menu', () => {
  it('keeps 시작 안내 unavailable and opens the other two rows', async () => {
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    const menu = await openMenu(user, '도움말');
    const rows = within(menu).getAllByRole('menuitem');
    expect(rows.map(row => row.textContent)).toEqual([
      '시작 안내',
      '로그 폴더 열기',
      '버전 정보',
    ]);
    expect(await reasonOf(rowOf(menu, '시작 안내'))).toBe(NOT_YET);
    expect(isOff(rowOf(menu, '로그 폴더 열기'))).toBe(false);
    expect(isOff(rowOf(menu, '버전 정보'))).toBe(false);
  });

  it('opens the log folder', async () => {
    const openLogFolder = vi.fn();
    window.llp = mockLlpApi({window: {openLogFolder}});
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    const menu = await openMenu(user, '도움말');
    await user.click(rowOf(menu, '로그 폴더 열기'));
    expect(openLogFolder).toHaveBeenCalledOnce();
  });

  it('shows the app name and version in a dialog with one 확인 button', async () => {
    window.llp = mockLlpApi({
      window: {
        appInfo: () => Promise.resolve({name: 'LoveLight', version: '1.2.3'}),
      },
    });
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    const menu = await openMenu(user, '도움말');
    await user.click(rowOf(menu, '버전 정보'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('버전 정보')).toBeTruthy();
    expect(within(dialog).getByText('LoveLight 1.2.3')).toBeTruthy();
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', {name: '확인'}));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('the 보기 menu 이어서 진행 row', () => {
  const stored = (atLastSlide?: 'stop' | 'nextItem') => ({
    name: 'preferences' as const,
    value: {
      format: 'llsettings.preferences' as const,
      schemaVersion: 1,
      ...(atLastSlide === undefined ? {} : {show: {atLastSlide}}),
    },
    revision: 5,
    access: 'editable' as const,
  });

  it('shows the choice as a check and flips it in 환경설정', async () => {
    const edit = vi.fn<(request: SettingsEdit) => Promise<EditResult>>(() =>
      Promise.resolve({
        ok: true as const,
        value: {id: 'preferences', revision: 6},
      }),
    );
    window.llp = mockLlpApi({
      settings: {get: () => Promise.resolve(stored('stop')), edit},
    });
    const user = userEvent.setup();
    render(<MenuBar title="" />);
    await waitFor(() => expect(window.llp?.settings.get).toBeDefined());
    let menu = await openMenu(user, '보기');
    const row = () =>
      within(menu).getByRole('menuitemcheckbox', {name: '이어서 진행'});
    await waitFor(() => expect(isOff(row())).toBe(false));
    expect(row().getAttribute('aria-checked')).toBe('false');
    await user.click(row());
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(edit.mock.calls[0]?.[0]).toMatchObject({
      type: 'settings.update',
      name: 'preferences',
      value: {show: {atLastSlide: 'nextItem'}},
    });
    menu = await openMenu(user, '보기');
    expect(row()).toBeTruthy();
  });

  it('is on when the choice is 다음 항목 and off for a file of a newer version', async () => {
    window.llp = mockLlpApi({
      settings: {get: () => Promise.resolve(stored('nextItem'))},
    });
    const user = userEvent.setup();
    const view = render(<MenuBar title="" />);
    let menu = await openMenu(user, '보기');
    await waitFor(() =>
      expect(
        within(menu)
          .getByRole('menuitemcheckbox', {name: '이어서 진행'})
          .getAttribute('aria-checked'),
      ).toBe('true'),
    );
    view.unmount();
    window.llp = mockLlpApi({
      settings: {
        get: () =>
          Promise.resolve({...stored('stop'), access: 'readOnly' as const}),
      },
    });
    render(<MenuBar title="" />);
    menu = await openMenu(user, '보기');
    await waitFor(() =>
      expect(
        isOff(
          within(menu).getByRole('menuitemcheckbox', {name: '이어서 진행'}),
        ),
      ).toBe(true),
    );
  });
});
