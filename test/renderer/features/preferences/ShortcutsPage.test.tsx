import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import type {ShortcutsFile} from '@core/schema/shortcuts';
import {settingsDefaults} from '@main/store/settingsDefaults';
import {
  parseSettingsDocument,
  type SettingsEdit,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {ShortcutsPage} from '@renderer/features/preferences/shortcuts/ShortcutsPage';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';

const edit = vi.fn<(request: SettingsEdit) => Promise<EditResult>>();
const onProblem = vi.fn();

type Bindings = ShortcutsFile['bindings'];

function documentOf(name: string, value: object, access: string) {
  return expectSuccess(
    parseSettingsDocument({name, value, revision: 4, access}),
  );
}

function defaultDocument(name: SettingsName) {
  return documentOf(
    name,
    {
      format: `llsettings.${name}`,
      schemaVersion: 1,
      ...settingsDefaults[name],
    },
    'editable',
  );
}

function install(
  bindings: Bindings = {},
  access: 'editable' | 'readOnly' = 'editable',
) {
  const shortcuts = documentOf(
    'shortcuts',
    {format: 'llsettings.shortcuts', schemaVersion: 1, bindings},
    access,
  );
  window.llp = mockLlpApi({
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'shortcuts' ? shortcuts : defaultDocument(name),
        ),
      edit: request => edit(request),
    },
  });
}

async function mount(bindings?: Bindings, access?: 'editable' | 'readOnly') {
  install(bindings, access);
  render(<ShortcutsPage onProblem={onProblem} />);
  await screen.findByRole('option', {name: /가사 지우기/});
}

function rowOf(name: RegExp | string): HTMLElement {
  return screen.getByRole('option', {name});
}

function written(): Bindings {
  const request = edit.mock.calls.at(-1)?.[0];
  if (request?.type !== 'settings.update' || request.name !== 'shortcuts') {
    throw new Error('Expected a shortcuts update');
  }
  return request.value.bindings;
}

beforeEach(() => {
  edit.mockReset();
  edit.mockResolvedValue({ok: true, value: {id: 'shortcuts', revision: 5}});
  onProblem.mockReset();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

async function editRow(name: RegExp | string) {
  const row = rowOf(name);
  fireEvent.doubleClick(row);
  return screen.findByRole('textbox', {name: /단축키/});
}

describe('ShortcutsPage', () => {
  it.each([
    {filter: /바꿈/, query: '', text: '바꾼 단축키 없음'},
    {filter: /겹침/, query: '', text: '겹친 단축키 없음'},
    {filter: /바꿈/, query: 'no matching command', text: '검색 결과 없음'},
  ])(
    'shows $text and safely ignores empty-list arrow steps',
    async ({filter, query, text}) => {
      await mount();
      await userEvent.click(rowOf(/가사 지우기/));
      await userEvent.click(screen.getByRole('radio', {name: filter}));
      const search = screen.getByRole('textbox', {name: '명령 찾기'});
      fireEvent.change(search, {target: {value: query}});
      const list = screen.getByRole('listbox', {name: '명령'});
      expect(within(list).getByRole('status').textContent).toBe(text);
      expect(within(list).queryAllByRole('option')).toHaveLength(0);
      search.focus();
      expect(() => {
        fireEvent.keyDown(list, {key: 'ArrowDown'});
        fireEvent.keyDown(list, {key: 'ArrowUp'});
      }).not.toThrow();
      expect(document.activeElement).toBe(search);
      expect(within(list).queryAllByRole('option')).toHaveLength(0);
      expect(edit).not.toHaveBeenCalled();
      fireEvent.change(search, {target: {value: ''}});
      await userEvent.click(screen.getByRole('radio', {name: /전체/}));
      expect(within(list).queryByRole('status')).toBeNull();
      expect(within(list).getAllByRole('option').length).toBeGreaterThan(0);
    },
  );

  it('lists the commands in groups without a 퀵 실행 group', async () => {
    await mount();

    expect(screen.getByRole('group', {name: '지우기'})).toBeTruthy();
    expect(screen.queryByRole('group', {name: '퀵 실행'})).toBeNull();
    expect(within(rowOf(/가사 지우기/)).getByText('F2')).toBeTruthy();
  });

  it('filters by the search text and by the 바꾼 것 and 겹침 counts', async () => {
    await mount({'clear.slide': [{code: 'F1', mods: []}]});

    expect(screen.getByRole('radio', {name: /바꿈/}).textContent).toContain(
      '1',
    );
    expect(screen.getByRole('radio', {name: /겹침/}).textContent).toContain(
      '2',
    );
    await userEvent.click(screen.getByRole('radio', {name: /겹침/}));
    expect(screen.getAllByRole('option')).toHaveLength(2);

    await userEvent.click(screen.getByRole('radio', {name: /전체/}));
    await userEvent.type(
      screen.getByRole('textbox', {name: '명령 찾기'}),
      '미디어 지우기',
    );
    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      expect.stringContaining('미디어 지우기'),
    ]);
  });

  it('marks both commands of a shared key and names the other', async () => {
    await mount({'clear.slide': [{code: 'F1', mods: []}]});

    expect(
      within(rowOf(/^가사 지우기/)).getByRole('img', {
        name: '모두 지우기와 겹침',
      }),
    ).toBeTruthy();
    expect(
      within(rowOf(/^모두 지우기/)).getByRole('img', {
        name: '가사 지우기와 겹침',
      }),
    ).toBeTruthy();
  });

  it('records the next key combination as the shortcut', async () => {
    await mount();
    const field = await editRow(/가사 지우기/);
    fireEvent.keyDown(field, {code: 'KeyJ', key: 'j', ctrlKey: true});

    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 4});
    expect(written()).toEqual({
      'clear.slide': [{code: 'KeyJ', mods: ['ctrl']}],
    });
    expect(screen.queryByRole('textbox', {name: /단축키/})).toBeNull();
  });

  it('cancels with Esc and removes with Backspace', async () => {
    await mount();
    let field = await editRow(/가사 지우기/);
    fireEvent.keyDown(field, {code: 'Escape', key: 'Escape'});
    expect(edit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', {name: /단축키/})).toBeNull();

    field = await editRow(/가사 지우기/);
    fireEvent.keyDown(field, {code: 'Backspace', key: 'Backspace'});
    await waitFor(() => expect(written()).toEqual({'clear.slide': []}));
  });

  it('refuses a reserved key with its reason and keeps recording', async () => {
    await mount();
    const field = await editRow(/가사 지우기/);
    fireEvent.keyDown(field, {code: 'KeyC', key: 'c', ctrlKey: true});

    expect(edit).not.toHaveBeenCalled();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('textbox', {name: /단축키/})).toBe(field);
  });

  it('opens the key field with Enter on a row', async () => {
    await mount();
    const row = rowOf(/가사 지우기/);
    row.focus();
    fireEvent.keyDown(row, {key: 'Enter'});

    expect(await screen.findByRole('textbox', {name: /단축키/})).toBeTruthy();
  });

  it('resets one command and clears one from the bottom bar', async () => {
    await mount({
      'clear.slide': [{code: 'KeyJ', mods: ['ctrl']}],
      'future.command': [{code: 'F8', mods: []}],
    });
    await userEvent.click(rowOf(/가사 지우기/));
    expect(screen.getByText('기본값')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', {name: '기본값으로'}));
    await waitFor(() =>
      expect(written()).toEqual({'future.command': [{code: 'F8', mods: []}]}),
    );

    edit.mockClear();
    await userEvent.click(rowOf(/미디어 지우기/));
    await userEvent.click(screen.getByRole('button', {name: '단축키 지우기'}));
    await waitFor(() => expect(written()).toMatchObject({'clear.media': []}));
  });

  it('offers editing first, followed by the bottom bar reset and clear actions', async () => {
    await mount({
      'clear.slide': [{code: 'KeyJ', mods: ['ctrl']}],
      'future.command': [{code: 'F8', mods: []}],
    });
    fireEvent.contextMenu(rowOf(/가사 지우기/));
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent),
    ).toEqual(['단축키 편집', '기본값으로', '지우기']);
    await userEvent.click(screen.getByRole('menuitem', {name: '기본값으로'}));
    await waitFor(() =>
      expect(written()).toEqual({'future.command': [{code: 'F8', mods: []}]}),
    );

    edit.mockClear();
    fireEvent.contextMenu(rowOf(/미디어 지우기/));
    await userEvent.click(screen.getByRole('menuitem', {name: '지우기'}));
    await waitFor(() => expect(written()).toMatchObject({'clear.media': []}));
  });

  it('opens the row menu with the Menu key, and disables what does not apply with its reason', async () => {
    await mount();
    const row = rowOf(/가사 지우기/);
    row.focus();

    fireEvent.keyDown(row, {key: 'ContextMenu'});

    const reset = await screen.findByRole('menuitem', {name: '기본값으로'});
    expect(reset.getAttribute('aria-disabled')).toBe('true');
    expect(reset.getAttribute('title')).toBeNull();
    expect(screen.getByRole('menuitem', {name: '지우기'})).toBeTruthy();
  });

  it.each([
    ['the Menu key', {key: 'ContextMenu'}],
    ['Shift F10', {key: 'F10', shiftKey: true}],
  ])(
    'opens the menu from %s below the focused row, not below the list',
    async (_name, key) => {
      await mount({'clear.slide': [{code: 'KeyJ', mods: ['ctrl']}]});
      const row = rowOf(/가사 지우기/);
      vi.spyOn(
        HTMLElement.prototype,
        'getBoundingClientRect',
      ).mockImplementation(function (this: HTMLElement): DOMRect {
        if (this === row) return new DOMRect(300, 200, 400, 30);
        if (this.getAttribute('role') === 'menu') {
          return new DOMRect(0, 0, 160, 80);
        }
        return new DOMRect(10, 10, 900, 600);
      });
      row.focus();

      fireEvent.keyDown(row, key);

      const menu = await screen.findByRole('menu', {name: '단축키 행 메뉴'});
      expect(menu.style.left).toBe('300px');
      expect(Number.parseInt(menu.style.top, 10)).toBeGreaterThanOrEqual(230);
      expect(row.hasAttribute('data-menu-target')).toBe(true);
    },
  );

  it('keeps the row menu actions disabled for a file of a newer version', async () => {
    await mount({'clear.slide': [{code: 'KeyJ', mods: ['ctrl']}]}, 'readOnly');

    fireEvent.contextMenu(rowOf(/가사 지우기/));

    for (const name of ['기본값으로', '지우기']) {
      expect(
        screen.getByRole('menuitem', {name}).getAttribute('aria-disabled'),
      ).toBe('true');
    }
    expect(edit).not.toHaveBeenCalled();
  });

  it('shows 기본값 없음 for a command without a default key', async () => {
    await mount();
    await userEvent.click(rowOf(/항목 끄기/));

    expect(screen.getByText('기본값 없음')).toBeTruthy();
    expect(
      screen
        .getByRole('button', {name: '단축키 지우기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('asks before 모두 기본값으로 and keeps the keys it does not show', async () => {
    await mount({
      'clear.slide': [{code: 'KeyJ', mods: ['ctrl']}],
      'quick.33333333-3333-4333-8333-333333333333': [{code: 'F9', mods: []}],
      'future.command': [{code: 'F8', mods: []}],
    });
    await userEvent.click(
      screen.getByRole('button', {name: '모두 기본값으로'}),
    );
    expect(edit).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog', {
      name: '모든 단축키를 기본값으로 되돌릴까요?',
    });
    await userEvent.click(
      within(dialog).getByRole('button', {name: '모두 기본값으로'}),
    );

    await waitFor(() =>
      expect(written()).toEqual({
        'quick.33333333-3333-4333-8333-333333333333': [{code: 'F9', mods: []}],
        'future.command': [{code: 'F8', mods: []}],
      }),
    );
  });

  it('writes nothing when the dialog is cancelled', async () => {
    await mount();
    await userEvent.click(
      screen.getByRole('button', {name: '모두 기본값으로'}),
    );
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', {name: '취소'}));

    expect(edit).not.toHaveBeenCalled();
  });

  it('shows the save failure when the write is refused', async () => {
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'changed'},
    });
    await mount();
    const field = await editRow(/가사 지우기/);
    fireEvent.keyDown(field, {code: 'KeyJ', key: 'j', ctrlKey: true});

    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '단축키 저장 실패'}),
      ),
    );
  });

  it('does not open the key field for a file of a newer version', async () => {
    await mount({}, 'readOnly');
    fireEvent.doubleClick(rowOf(/가사 지우기/));

    expect(screen.queryByRole('textbox', {name: /단축키/})).toBeNull();
    const api = window.llp;
    if (api !== undefined) expect(pendingWritesOf(api).isStopped).toBe(false);
  });
});
