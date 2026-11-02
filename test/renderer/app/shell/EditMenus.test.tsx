import {cleanup, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useState, type JSX} from 'react';
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

describe('the 편집 menu', () => {
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
      '글자 입력란에서 쓸 수 있습니다',
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
        <Duplicates reason="테마는 200개까지 추가할 수 있음" run={run} />
      </>,
    );
    screen.getByRole('button', {name: 'list'}).focus();
    menu = await openMenu(user, '편집');
    expect(rowOf(menu, '복제').textContent).toBe('복제Ctrl D');
    expect(await reasonOf(rowOf(menu, '복제'))).toBe(
      '테마는 200개까지 추가할 수 있음',
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
