import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {ThemeFile} from '@core/schema/theme';
import type {Themes} from '@core/schema/themes';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {ThemeLeaveGuard} from '@renderer/features/screens/themes/themeLeaveGuard';
import {useThemePanels} from '@renderer/features/screens/themes/useThemePanels';
import {useThemes} from '@renderer/platform/themes';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themes, themeScreens} from '@fixtures/core/themeOutput';

const report = vi.fn();

function Harness({
  leaveGuard,
}: {
  readonly leaveGuard: ThemeLeaveGuard;
}): JSX.Element {
  const panels = useThemePanels(true, report, leaveGuard);
  return (
    <>
      {panels.left}
      {panels.canvas}
      {panels.right}
    </>
  );
}

async function setup() {
  let value: Themes = themes();
  let revision = 1;
  const listeners = new Set<(document: SettingsDocument) => void>();
  const document = () => settingsDocument('themes', value, revision);
  const api = mockLlpApi({
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'themes'
            ? document()
            : settingsDocument('screens', {screens: themeScreens}),
        ),
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      edit: edit => {
        if (edit.type !== 'settings.update' || edit.name !== 'themes') {
          return Promise.reject(new Error('Unexpected edit'));
        }
        value = edit.value;
        revision += 1;
        for (const listener of listeners) listener(document());
        return Promise.resolve({ok: true, value: {id: 'themes', revision}});
      },
    },
  });
  window.llp = api;
  const leaveGuard = new ThemeLeaveGuard();
  render(<Harness leaveGuard={leaveGuard} />);
  await screen.findByText('찬양 가사 (밝은 배경)');
  return {
    user: userEvent.setup(),
    leaveGuard,
    saved: (id: ThemeFile['id']) => value.themes.find(theme => theme.id === id),
    list: () => value,
  };
}

type User = Awaited<ReturnType<typeof setup>>['user'];

function themeRow(id: ThemeFile['id']): HTMLElement {
  const row = screen
    .getByRole('listbox', {name: '테마'})
    .querySelector<HTMLElement>(`[role="option"][data-value="${id}"]`);
  if (row === null) throw new Error(`No theme ${id}`);
  return row;
}
const elementRow = (name: string | RegExp) =>
  within(screen.getByRole('listbox', {name: '요소'})).getByRole('option', {
    name,
  });
const elementRows = () =>
  within(screen.getByRole('listbox', {name: '요소'})).getAllByRole('option');
const properties = () =>
  within(screen.getByRole('region', {name: '테마 속성'}));
const save = () => screen.getByRole('button', {name: '저장'});

async function openTab(user: User, name: '요소' | '화면' | '테마') {
  await user.click(properties().getByRole('tab', {name}));
}

async function overwrite(user: User) {
  await user.click(save());
  await user.click(await screen.findByRole('button', {name: '덮어쓰기'}));
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useThemes.setState({themes: themes(), screens: themeScreens});
});
afterEach(() => {
  report.mockReset();
  delete window.llp;
});

describe('elements', () => {
  it('changes a text and saves it only after asking', async () => {
    const {user, saved} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await user.click(elementRow('가사'));
    const size = properties().getByRole('spinbutton', {name: '크기'});
    fireEvent.change(size, {target: {value: '90'}});
    fireEvent.blur(size);
    expect(saved(BUILT_IN_THEME_IDS.lyrics)).toEqual(
      themes().themes.find(theme => theme.id === BUILT_IN_THEME_IDS.lyrics),
    );
    await overwrite(user);
    await waitFor(() => {
      const layout = saved(BUILT_IN_THEME_IDS.lyrics)?.screens.audience;
      const text =
        layout?.mode === 'own'
          ? layout.elements.find(element => element.kind === 'text')
          : undefined;
      expect(text?.kind === 'text' ? text.style.size : undefined).toBe(90);
    });
    expect(save().getAttribute('aria-disabled')).toBe('true');
  });

  it('steps back through the changes that are not saved', async () => {
    const {user} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    const before = elementRows().length;
    await user.click(screen.getByRole('button', {name: '사각형'}));
    expect(elementRows()).toHaveLength(before + 1);
    expect(save().getAttribute('aria-disabled')).toBeNull();
    await user.keyboard('{Control>}z{/Control}');
    expect(elementRows()).toHaveLength(before);
    expect(save().getAttribute('aria-disabled')).toBe('true');
    await user.keyboard('{Control>}y{/Control}');
    expect(elementRows()).toHaveLength(before + 1);
  });

  it('adds a box with a name of its own, and removes it again', async () => {
    const {user} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await user.click(screen.getByRole('button', {name: '글 상자'}));
    const added = elementRow(/글 상자|상자/u);
    expect(added).toBeTruthy();
    await openTab(user, '테마');
    expect(
      properties()
        .getAllByRole('textbox', {name: '이름'})
        .map(field => field.getAttribute('value')),
    ).toHaveLength(2);
    await user.click(elementRows()[0] ?? added);
    await user.keyboard('{Delete}');
    expect(elementRows().some(row => /상자/u.test(row.textContent ?? ''))).toBe(
      false,
    );
  });

  it('brings an element to the front and back with its menu', async () => {
    const {user} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.notice));
    const names = () => elementRows().map(row => row.textContent);
    const before = names();
    const last = elementRows().at(-1);
    if (last === undefined) throw new Error('Missing element');
    fireEvent.contextMenu(last);
    await user.click(
      screen.getByRole('menuitem', {name: '맨 앞으로 가져오기'}),
    );
    expect(names()).toEqual([before.at(-1), ...before.slice(0, -1)]);
  });

  it('copies an element to another screen', async () => {
    const {user} = await setup();
    const data = new Map<string, string>();
    const clipboardData = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    };
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await user.click(screen.getByRole('button', {name: '사각형'}));
    await user.click(elementRow('사각형'));
    fireEvent.copy(elementRow('사각형'), {clipboardData});
    await user.click(properties().getByRole('button', {name: 'Stage 편집'}));
    const before = elementRows();
    const [first] = before;
    if (first === undefined) throw new Error('Missing element');
    fireEvent.paste(first, {clipboardData});
    await waitFor(() => expect(elementRows()).toHaveLength(before.length + 1));
    expect(elementRow('사각형')).toBeTruthy();
  });

  it('shows the fields of a shape and changes its fill', async () => {
    const {user} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.blank));
    await user.click(screen.getByRole('button', {name: '사각형'}));
    await user.click(elementRow('사각형'));
    await user.click(properties().getByRole('radio', {name: '그라데이션'}));
    expect(properties().getAllByText(/^색 \d$/u).length).toBeGreaterThanOrEqual(
      2,
    );
    await user.click(properties().getByRole('checkbox', {name: '테두리'}));
    expect(properties().getByRole('spinbutton', {name: '두께'})).toBeTruthy();
  });
});

describe('a theme and its screens', () => {
  it('makes a screen show what another one shows, and nothing', async () => {
    const {user, saved} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await user.click(properties().getByRole('button', {name: 'Stage 편집'}));
    await openTab(user, '화면');
    await user.click(properties().getByRole('radio', {name: '비움'}));
    await overwrite(user);
    await waitFor(() =>
      expect(saved(BUILT_IN_THEME_IDS.lyrics)?.screens.stage.mode).toBe(
        'empty',
      ),
    );
  });

  it('changes the next text of a theme', async () => {
    const {user, saved} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await openTab(user, '테마');
    await user.click(
      properties().getByRole('checkbox', {name: '마지막에는 숨김'}),
    );
    await overwrite(user);
    await waitFor(() =>
      expect(saved(BUILT_IN_THEME_IDS.lyrics)?.hideNextAtEnd).toBe(true),
    );
  });

  it('asks before another theme is opened, and can drop the changes', async () => {
    const {user, saved} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await user.click(screen.getByRole('button', {name: '사각형'}));
    await user.click(themeRow(BUILT_IN_THEME_IDS.notice));
    await user.click(screen.getByRole('button', {name: '저장 안 함'}));
    expect(
      themeRow(BUILT_IN_THEME_IDS.notice).getAttribute('aria-selected'),
    ).toBe('true');
    expect(saved(BUILT_IN_THEME_IDS.lyrics)?.screens).toEqual(
      themes().themes.find(theme => theme.id === BUILT_IN_THEME_IDS.lyrics)
        ?.screens,
    );
  });

  it('asks before the workspace is left', async () => {
    const {user, leaveGuard} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    const proceed = vi.fn();
    act(() => leaveGuard.leave(proceed));
    expect(proceed).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', {name: '사각형'}));
    act(() => leaveGuard.leave(proceed));
    expect(proceed).toHaveBeenCalledOnce();
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '저장',
      }),
    );
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(2));
  });
});

describe('the list', () => {
  async function menu(user: User, row: HTMLElement, entry: string) {
    fireEvent.contextMenu(row);
    await user.click(
      screen.getByRole(/지정$/u.test(entry) ? 'menuitemcheckbox' : 'menuitem', {
        name: entry,
      }),
    );
  }

  it('makes a theme for a purpose, and the one new slides get', async () => {
    const {user, list} = await setup();
    await user.click(screen.getByRole('button', {name: '새 테마'}));
    await user.click(screen.getByRole('menuitem', {name: '광고'}));
    await waitFor(() =>
      expect(list().themes).toHaveLength(themes().themes.length + 1),
    );
    const added = list().themes.find(
      theme => !themes().themes.some(known => known.id === theme.id),
    );
    expect(added?.purpose).toBe('notice');
    if (added === undefined) throw new Error('Missing theme');
    await menu(user, themeRow(added.id), '기본으로 지정');
    await waitFor(() => expect(list().defaults.notice).toBe(added.id));
  });

  it('duplicates and deletes a theme of the operator, and not one of the app', async () => {
    const {user, list} = await setup();
    await menu(user, themeRow(BUILT_IN_THEME_IDS.lyrics), '복제');
    await waitFor(() =>
      expect(list().themes).toHaveLength(themes().themes.length + 1),
    );
    const copy = list().themes.find(
      theme => !themes().themes.some(known => known.id === theme.id),
    );
    if (copy === undefined) throw new Error('Missing copy');
    fireEvent.contextMenu(themeRow(BUILT_IN_THEME_IDS.notice));
    expect(
      screen
        .getByRole('menuitem', {name: '삭제'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await user.keyboard('{Escape}');
    await menu(user, themeRow(copy.id), '삭제');
    const confirm = screen.queryByRole('alertdialog');
    if (confirm !== null) {
      await user.click(within(confirm).getByRole('button', {name: '삭제'}));
    }
    await waitFor(() =>
      expect(list().themes).toHaveLength(themes().themes.length),
    );
  });

  it('saves a changed theme under another name', async () => {
    const {user, list, saved} = await setup();
    await user.click(themeRow(BUILT_IN_THEME_IDS.lyrics));
    await user.click(screen.getByRole('button', {name: '사각형'}));
    await user.click(screen.getByRole('button', {name: '다른 이름으로 저장…'}));
    const name = screen.getByRole('textbox', {name: '테마 이름'});
    fireEvent.change(name, {target: {value: '내 가사'}});
    fireEvent.keyDown(name, {key: 'Enter'});
    await waitFor(() =>
      expect(list().themes.some(theme => theme.name === '내 가사')).toBe(true),
    );
    expect(saved(BUILT_IN_THEME_IDS.lyrics)?.screens).toEqual(
      themes().themes.find(theme => theme.id === BUILT_IN_THEME_IDS.lyrics)
        ?.screens,
    );
    const own = list().themes.find(theme => theme.name === '내 가사');
    if (own === undefined) throw new Error('Missing theme');
    expect(themeRow(own.id).getAttribute('aria-selected')).toBe('true');
  });
});
