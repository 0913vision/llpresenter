import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorFixture} from './editorFixture';
import {editorSetup, lyrics} from './editorTesting';
import {hoverForTooltip} from '@renderer/ui/tooltipTesting';

async function openMenu(user: Awaited<ReturnType<typeof editorSetup>>['user']) {
  await user.click(screen.getByRole('button', {name: '1절'}));
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

  it('only offers selection and the single manager without row context menus', async () => {
    const {user} = await editorSetup();
    const menu = await openMenu(user);
    expect(menu.getAttribute('data-check-column')).toBe('true');
    expect(
      [...menu.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual(['이름표 없음', '|', '1절', '후렴', '|', '이름표 관리…']);
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
        within(row).getByRole('radiogroup', {name: `${label.name} 색`}),
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
    expect((await hoverForTooltip(field))?.textContent).toBe(
      '모든 곡에서 이 이름표의 이름을 바꿉니다',
    );
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
      expect(document.song.groups[0]?.name).toBe('새 절');
    }
    expect(session.history.snapshot.song.groups[0]?.name).toBe('새 절');
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
    const colors = within(dialog).getByRole('radiogroup', {name: '1절 색'});
    expect(within(colors).getAllByRole('radio')).toHaveLength(9);
    expect(
      (await hoverForTooltip(within(colors).getByRole('radio', {name: '초록'})))
        ?.textContent,
    ).toBe('초록모든 곡에 적용');
    vi.useRealTimers();
    await user.click(within(colors).getByRole('radio', {name: '초록'}));
    await waitFor(() => expect(labels().value.labels[0]?.color).toBe('green'));
    expect(labels().value.labels[1]?.key).toBe('KeyC');
    await user.click(screen.getByRole('button', {name: '새 이름표'}));
    await waitFor(() => expect(labels().value.labels).toHaveLength(3));
    expect(session.history.snapshot.song.groups[0]?.name).toBe('1절');
  });

  it('saves a dirty name before applying a color with the same click', async () => {
    const {user, labels} = await editorSetup();
    const dialog = await openManager(user);
    const field = screen.getByRole('textbox', {name: '1절 이름'});
    await user.clear(field);
    await user.type(field, '새 절');
    await user.click(
      within(
        within(dialog).getByRole('radiogroup', {name: '1절 색'}),
      ).getByRole('radio', {name: '초록'}),
    );
    await waitFor(() =>
      expect(labels().value.labels[0]).toMatchObject({
        name: '새 절',
        color: 'green',
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
    expect((await hoverForTooltip(remove))?.textContent).toBe(
      '공유 목록에서만 삭제하며 곡의 이름표는 유지합니다',
    );
    vi.useRealTimers();
    await user.click(remove);
    const confirmation = screen.getByRole('alertdialog');
    expect(
      within(confirmation).getByText('모든 곡의 이름표 유지'),
    ).toBeDefined();
    expect(labels().value.labels).toHaveLength(2);
    await user.click(within(confirmation).getByRole('button', {name: '삭제'}));
    await waitFor(() => expect(labels().value.labels).toHaveLength(1));
    expect(session.history.snapshot.song.groups[0]?.name).toBe('1절');
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
    for (const radio of within(dialog).getAllByRole('radio')) {
      expect(radio.getAttribute('aria-disabled')).toBe('true');
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
    expect(session.history.snapshot.song.groups[0]?.name).toBe('후렴');
  });

  it('chooses and removes a label with keyboard navigation and restores focus', async () => {
    const {user, session} = await editorSetup();
    await openMenu(user);
    await user.keyboard('{ArrowDown}{Enter}');
    await act(() => session.flush());
    expect(session.history.snapshot.song.groups[0]?.name).toBe('후렴');
    await user.click(
      screen.getAllByRole('button', {name: '후렴'})[0] ?? document.body,
    );
    await user.click(screen.getByRole('menuitemradio', {name: '이름표 없음'}));
    expect(session.history.snapshot.song.groups[0]?.name).toBe('');
  });

  it('supports Escape and outside focus without taking it back', async () => {
    const {user} = await editorSetup();
    await openMenu(user);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '1절'}),
    );
    await openMenu(user);
    await user.click(lyrics());
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(lyrics());
  });
});
