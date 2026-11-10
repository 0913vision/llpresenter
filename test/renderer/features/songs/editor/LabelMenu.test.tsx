import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {
  editorSetup,
  lyrics,
} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {hoverForTooltip} from '@fixtures/renderer/ui/tooltipTesting';

async function openMenu(user: Awaited<ReturnType<typeof editorSetup>>['user']) {
  await user.click(screen.getByRole('button', {name: '1절 1'}));
  return screen.getByRole('menu', {name: '이름표'});
}

async function openManager(
  user: Awaited<ReturnType<typeof editorSetup>>['user'],
) {
  await openMenu(user);
  await user.click(screen.getByRole('menuitem', {name: '이름표 관리…'}));
  return screen.getByRole('dialog', {name: '이름표 관리'});
}

describe('song editor label menu', () => {
  it('opens the manager without arming a global rename and tabs into the first name', async () => {
    const {user, labels, labelEdits} = await editorSetup();
    const dialog = await openManager(user);
    expect(document.activeElement).toBe(dialog);
    for (const field of within(dialog).getAllByRole('textbox')) {
      if (!(field instanceof HTMLInputElement)) {
        throw Error('Missing name input');
      }
      expect(field.selectionStart).toBe(field.selectionEnd);
    }
    await user.keyboard('x');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(labels().value.labels[0]?.name).toBe('1절');
    expect(labelEdits).toHaveLength(0);
    await user.tab();

    expect(document.activeElement).toBe(
      within(dialog).getByRole('textbox', {name: '1절 이름'}),
    );
  });

  it('saves a keyboard reorder and uses catalog order in the label menu', async () => {
    const {user, labels, labelEdits} = await editorSetup();
    const dialog = await openManager(user);
    const handle = within(dialog).getByRole('button', {name: '후렴 순서 이동'});
    handle.focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await waitFor(() =>
      expect(labels().value.labels.map(label => label.name)).toEqual([
        '후렴',
        '1절',
      ]),
    );
    expect(document.activeElement).toBe(handle);
    expect(labelEdits).toHaveLength(1);
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(labelEdits).toHaveLength(1);
    await user.click(
      within(dialog).getAllByRole('button', {name: '닫기'}).at(-1) ?? dialog,
    );
    const menu = await openMenu(user);
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map(row => row.textContent),
    ).toEqual(['이름표 없음', '후렴', '1절']);
  });

  it('drags only from the grip, marks the insertion, and saves the drop', async () => {
    const {user, labels, labelEdits} = await editorSetup();
    const dialog = await openManager(user);
    const row = within(dialog).getByRole('group', {name: '1절'});
    const grip = within(dialog).getByRole('button', {name: '후렴 순서 이동'});
    const data = new Map<string, string>();
    const dataTransfer = {
      types: ['application/x-llp-label'],
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: '',
      dropEffect: '',
    };
    expect(row.draggable).toBe(false);
    expect(grip.draggable).toBe(true);
    fireEvent.dragStart(grip, {dataTransfer});
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 400, 30),
    );
    fireEvent.dragOver(row, {dataTransfer, clientY: 1});
    expect(row.getAttribute('data-drop')).toBe('before');
    fireEvent.drop(row, {dataTransfer, clientY: 1});
    await waitFor(() => expect(labels().value.labels[0]?.name).toBe('후렴'));
    expect(labelEdits).toHaveLength(1);
    expect(row.getAttribute('data-drop')).toBeNull();
  });

  it('only offers selection and the single manager without row context menus', async () => {
    const {user} = await editorSetup();
    const menu = await openMenu(user);
    expect(menu.getAttribute('data-check-column')).toBe('true');
    expect(
      [...menu.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual([
      '이름표 없음',
      '|',
      '1절',
      '후렴',
      '|',
      '이름 적기…',
      '|',
      '이름표 관리…',
    ]);
    const row = within(menu).getByRole('menuitemradio', {name: '1절'});
    fireEvent.contextMenu(row);
    fireEvent.keyDown(row, {key: 'F10', shiftKey: true});
    fireEvent.keyDown(row, {key: 'ContextMenu'});
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(row.hasAttribute('aria-haspopup')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows editable names, accessible palettes, and only add and close footer actions', async () => {
    const {user, labels} = await editorSetup();
    const dialog = await openManager(user);
    expect(screen.queryByRole('menu', {name: '이름표'})).toBeNull();
    for (const label of labels().value.labels) {
      const row = within(dialog).getByRole('group', {name: label.name});
      expect(
        within(row).getByRole('textbox', {name: `${label.name} 이름`}),
      ).toHaveProperty('value', label.name);
      expect(
        within(row).getByRole('button', {name: `${label.name} 색`}),
      ).toBeDefined();
      expect(within(row).queryByText(`${label.name} 색`)).toBeNull();
    }
    expect(within(dialog).queryByRole('button', {name: '확인'})).toBeNull();
    expect(within(dialog).queryByRole('button', {name: '취소'})).toBeNull();
    expect(within(dialog).getAllByRole('button', {name: '닫기'})).toHaveLength(
      2,
    );
    await user.click(within(dialog).getByRole('button', {name: '새 이름표'}));
    await waitFor(() =>
      expect(labels().value.labels.at(-1)?.name).toBe('새 이름표'),
    );
    const field = screen.getByRole('textbox', {name: '새 이름표 이름'});
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('selectionStart', 0);
    await user.keyboard('끝{Enter}');
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '끝 이름'})).toHaveProperty(
        'value',
        '끝',
      ),
    );
    await user.click(screen.getByRole('button', {name: '새 이름표'}));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '새 이름표 이름'})).toBe(
        document.activeElement,
      ),
    );
    await user.click(screen.getByRole('button', {name: '새 이름표'}));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '새 이름표 2 이름'})).toBe(
        document.activeElement,
      ),
    );
    expect(labels().value.labels.at(-1)).toEqual({
      name: '새 이름표 2',
      color: 'none',
      key: null,
    });
  });

  it('renames globally on Enter and blur, preserving the field for further edits', async () => {
    const {user, labelEdits, documents, session} = await editorSetup();
    await openManager(user);
    let field = screen.getByRole('textbox', {name: '1절 이름'});
    expect((await hoverForTooltip(field))?.textContent).toBe(undefined);
    vi.useRealTimers();
    await user.clear(field);
    await user.type(field, '새 절{Enter}');
    await waitFor(() =>
      expect(labelEdits.at(-1)).toMatchObject({
        type: 'labels.rename',
        from: '1절',
        to: '새 절',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '새 절 이름'})).toHaveProperty(
        'readOnly',
        false,
      ),
    );
    for (const document of documents.values()) {
      expect(document.song.slides[0]?.label).toBe('새 절');
    }
    expect(session.history.snapshot.song.slides[0]?.label).toBe('새 절');
    field = screen.getByRole('textbox', {name: '새 절 이름'});
    await user.clear(field);
    await user.type(field, '다음 절');
    await user.tab();
    await waitFor(() =>
      expect(labelEdits.at(-1)).toMatchObject({
        type: 'labels.rename',
        from: '새 절',
        to: '다음 절',
      }),
    );
    expect(screen.getByRole('dialog', {name: '이름표 관리'})).toBeDefined();
  });

  it('rejects duplicates, ignores modified Enter, and cancels a name draft with Escape', async () => {
    const {user, labelEdits} = await editorSetup();
    await openManager(user);
    const field = screen.getByRole('textbox', {name: '1절 이름'});
    await user.clear(field);
    await user.type(field, '후렴{Enter}');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(labelEdits).toHaveLength(0);
    await user.clear(field);
    await user.type(field, '새 절');
    fireEvent.keyDown(field, {key: 'Enter', ctrlKey: true});
    expect(labelEdits).toHaveLength(0);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', {name: '1절 이름'})).toHaveProperty(
      'value',
      '1절',
    );
    expect(screen.getByRole('dialog', {name: '이름표 관리'})).toBeDefined();
  });

  it('applies shared colors without changing legacy keys or assigning newly created labels', async () => {
    const {user, labels, session} = await editorSetup();
    const dialog = await openManager(user);
    await user.click(within(dialog).getByRole('button', {name: '1절 색'}));
    const colors = screen.getByRole('radiogroup', {name: '1절 색'});
    expect(within(colors).getAllByRole('radio')).toHaveLength(9);
    expect(
      (await hoverForTooltip(within(colors).getByRole('radio', {name: '초록'})))
        ?.textContent,
    ).toBe('초록');
    vi.useRealTimers();
    await user.click(within(colors).getByRole('radio', {name: '초록'}));
    await waitFor(() =>
      expect(labels().value.labels[0]?.color).toBe('#8FBF7A'),
    );
    expect(labels().value.labels[1]?.key).toBe('KeyC');
    await user.click(screen.getByRole('button', {name: '새 이름표'}));
    await waitFor(() => expect(labels().value.labels).toHaveLength(3));
    expect(session.history.snapshot.song.slides[0]?.label).toBe('1절');
  });

  it('saves a dirty name before applying a color with the same click', async () => {
    const {user, labels} = await editorSetup();
    const dialog = await openManager(user);
    const field = screen.getByRole('textbox', {name: '1절 이름'});
    await user.clear(field);
    await user.type(field, '새 절');
    await user.click(within(dialog).getByRole('button', {name: '1절 색'}));
    await user.click(
      within(
        await screen.findByRole('radiogroup', {name: '새 절 색'}),
      ).getByRole('radio', {name: '초록'}),
    );
    await waitFor(() =>
      expect(labels().value.labels[0]).toMatchObject({
        name: '새 절',
        color: '#8FBF7A',
      }),
    );
  });

  it('keeps an invalid name open and saves its correction before closing', async () => {
    const {user, labels} = await editorSetup();
    const dialog = await openManager(user);
    const field = screen.getByRole('textbox', {name: '1절 이름'});
    await user.clear(field);
    await user.type(field, '후렴');
    await user.click(
      within(dialog).getAllByRole('button', {name: '닫기'}).at(-1) ??
        document.body,
    );
    expect(screen.getByRole('dialog', {name: '이름표 관리'})).toBe(dialog);
    expect(labels().value.labels[0]?.name).toBe('1절');
    await user.clear(field);
    await user.type(field, '끝 절');
    await user.click(
      within(dialog).getAllByRole('button', {name: '닫기'}).at(-1) ??
        document.body,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(labels().value.labels[0]?.name).toBe('끝 절');
  });

  it('confirms catalog deletion, keeps song references, and restores focus after the last row', async () => {
    const {user, labels, session} = await editorSetup();
    const dialog = await openManager(user);
    const remove = within(dialog).getByRole('button', {name: '1절 삭제'});
    expect((await hoverForTooltip(remove))?.textContent).toBe('1절 삭제');
    vi.useRealTimers();
    await user.click(remove);
    const confirmation = screen.getByRole('alertdialog');
    expect(
      within(confirmation).getByText('곡에 붙은 이름표는 남습니다'),
    ).toBeDefined();
    expect(labels().value.labels).toHaveLength(2);
    await user.click(within(confirmation).getByRole('button', {name: '삭제'}));
    await waitFor(() => expect(labels().value.labels).toHaveLength(1));
    expect(session.history.snapshot.song.slides[0]?.label).toBe('1절');
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '후렴 이름'})).toBe(
        document.activeElement,
      ),
    );
    await user.click(screen.getByRole('button', {name: '후렴 삭제'}));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() => expect(labels().value.labels).toHaveLength(0));
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.click(
      within(dialog).getAllByRole('button', {name: '닫기'}).at(-1) ??
        document.body,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', {name: '이름표 관리…'}),
    );
  });

  it('allows selection while protecting every control of a read-only catalog', async () => {
    const fixture = editorFixture();
    vi.spyOn(fixture.api.settings, 'get').mockResolvedValue({
      ...fixture.labels(),
      access: 'readOnly',
    });
    const {user, session} = await editorSetup(fixture);
    const dialog = await openManager(user);
    for (const field of within(dialog).getAllByRole('textbox')) {
      expect(field).toHaveProperty('readOnly', true);
    }
    for (const label of fixture.labels().value.labels) {
      expect(
        within(dialog)
          .getByRole('button', {name: `${label.name} 색`})
          .getAttribute('aria-disabled'),
      ).toBe('true');
      expect(
        within(dialog)
          .getByRole('button', {name: `${label.name} 순서 이동`})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    }
    const add = within(dialog).getByRole('button', {name: '새 이름표'});
    expect(add.getAttribute('aria-disabled')).toBe('true');
    await user.click(add);
    await user.click(within(dialog).getByRole('button', {name: '1절 삭제'}));
    expect(fixture.labelEdits).toHaveLength(0);
    await user.click(
      within(dialog).getAllByRole('button', {name: '닫기'}).at(-1) ??
        document.body,
    );
    await user.click(screen.getByRole('menuitemradio', {name: '후렴'}));
    expect(session.history.snapshot.song.slides[0]?.label).toBe('후렴');
  });

  it('chooses and removes a label with keyboard navigation and restores focus', async () => {
    const {user, session} = await editorSetup();
    await openMenu(user);
    await user.keyboard('{ArrowDown}{Enter}');
    await act(() => session.flush());
    expect(session.history.snapshot.song.slides[0]?.label).toBe('후렴');
    await user.click(screen.getByRole('button', {name: '후렴 1'}));
    await user.click(screen.getByRole('menuitemradio', {name: '이름표 없음'}));
    expect(session.history.snapshot.song.slides[0]?.label).toBeUndefined();
  });

  it('supports Escape and outside focus without taking it back', async () => {
    const {user} = await editorSetup();
    await openMenu(user);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '1절 1'}),
    );
    await openMenu(user);
    await user.click(lyrics());
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(lyrics());
  });
});

it('assigns a trimmed free name without creating a shared catalog entry', async () => {
  const {user, session, labels, labelEdits} = await editorSetup();
  const before = labels();
  await openMenu(user);
  await user.click(screen.getByRole('menuitem', {name: '이름 적기…'}));
  const input = screen.getByRole('textbox', {name: '이름 적기'});
  await user.clear(input);
  await user.type(input, '  현장 반복  {Enter}');
  expect(session.history.snapshot.song.slides[0]?.label).toBe('현장 반복');
  expect(labels()).toEqual(before);
  expect(labelEdits).toHaveLength(0);
});
