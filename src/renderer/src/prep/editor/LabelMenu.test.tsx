import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorFixture} from './editorFixture';
import {editorSetup, lyrics} from './editorTesting';
import {hoverForTooltip} from '@renderer/ui/tooltipTesting';

async function openMenu(user: Awaited<ReturnType<typeof editorSetup>>['user']) {
  await user.click(screen.getByRole('button', {name: '1절'}));
  return screen.getByRole('menu', {name: '이름표'});
}

async function manage(name: string, action: string) {
  fireEvent.contextMenu(screen.getByRole('menuitemradio', {name}), {
    clientX: 20,
    clientY: 20,
  });
  fireEvent.click(screen.getByRole('menuitem', {name: action}));
  return screen.findByRole('dialog');
}

describe('song editor label menu', () => {
  it('discloses shared color scope before applying a color', async () => {
    const {user, labelEdits} = await editorSetup();
    const menu = await openMenu(user);
    const color = within(menu).getByRole('radio', {name: '초록'});
    expect((await hoverForTooltip(color))?.textContent).toBe(
      '초록모든 곡에 적용',
    );
    expect(labelEdits).toHaveLength(0);
  });

  it('explains the library-wide rename from its name field', async () => {
    const {user, labelEdits} = await editorSetup();
    await openMenu(user);
    const dialog = await manage('1절', '이름 바꾸기');
    const input = within(dialog).getByRole('textbox', {name: '이름표 이름'});
    const tooltip = await hoverForTooltip(input);
    expect(tooltip?.textContent).toBe(
      '모든 곡에서 이 이름표의 이름을 바꿉니다',
    );
    expect(labelEdits).toHaveLength(0);
  });

  it('allows label selection but protects a read-only global list', async () => {
    const fixture = editorFixture();
    vi.spyOn(fixture.api.settings, 'get').mockResolvedValue({
      ...fixture.labels(),
      access: 'readOnly',
    });
    const {user, session} = await editorSetup(fixture);
    const menu = await openMenu(user);
    const create = within(menu).getByRole('menuitem', {name: '새 이름표'});
    expect(create.getAttribute('aria-disabled')).toBe('true');
    await user.click(create);
    expect(screen.queryByRole('textbox', {name: '새 이름표 이름'})).toBeNull();
    await user.click(within(menu).getByRole('radio', {name: '초록'}));
    expect(fixture.labelEdits).toHaveLength(0);
    await user.click(within(menu).getByRole('menuitemradio', {name: /후렴/}));
    expect(session.history.snapshot.song.groups[0]?.name).toBe('후렴');
  });
  it('chooses a label, removes it, and returns focus without stealing it on save pushes', async () => {
    const {user, session} = await editorSetup();
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /후렴/}));
    await act(() => session.flush());
    expect(session.history.snapshot.song.groups[0]?.name).toBe('후렴');
    expect(document.activeElement).toBe(
      screen.getAllByRole('button', {name: '후렴'})[0],
    );
    await user.click(
      screen.getAllByRole('button', {name: '후렴'})[0] ?? document.body,
    );
    await user.click(screen.getByRole('menuitemradio', {name: '이름표 없음'}));
    expect(session.history.snapshot.song.groups[0]?.name).toBe('');
  });

  it('changes the global color immediately, stays open, and recolors another song', async () => {
    const {user, store, second, labels} = await editorSetup();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('radio', {name: '초록'}));
    await waitFor(() => expect(labels().value.labels[0]?.color).toBe('green'));
    expect(screen.getByRole('menu', {name: '이름표'})).toBe(menu);
    expect(
      screen.getByRole('button', {name: '1절'}).getAttribute('data-color'),
    ).toBe('green');
    await user.keyboard('{Escape}');
    act(() => store.open(second));
    expect(
      screen.getByRole('button', {name: '1절'}).getAttribute('data-color'),
    ).toBe('green');
  });

  it('creates a name inline, rejects duplicates, and assigns its default color and key', async () => {
    const {user, labels, session} = await editorSetup();
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', {name: '새 이름표'}));
    const field = screen.getByRole('textbox', {name: '새 이름표 이름'});
    await user.type(field, '1절{Enter}');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(labels().value.labels).toHaveLength(2);
    await user.clear(field);
    await user.type(field, '끝{Enter}');
    await waitFor(() =>
      expect(screen.queryByRole('menu', {name: '이름표'})).toBeNull(),
    );
    expect(labels().value.labels.at(-1)).toEqual({
      name: '끝',
      color: 'none',
      key: null,
    });
    expect(session.history.snapshot.song.groups[0]?.name).toBe('끝');
    expect(
      screen.getByRole('button', {name: '끝'}).getAttribute('data-color'),
    ).toBe('none');
  });

  it('opens management from the keyboard and renames every song through labels.rename', async () => {
    const {user, labelEdits, documents, session} = await editorSetup();
    await openMenu(user);
    const row = screen.getByRole('menuitemradio', {name: '1절'});
    fireEvent.keyDown(row, {key: 'F10', code: 'F10', shiftKey: true});
    await user.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('1절')).toBeDefined();
    const field = within(dialog).getByRole('textbox', {name: '이름표 이름'});
    await user.clear(field);
    await user.type(field, '새 절{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(labelEdits.at(-1)).toMatchObject({
      type: 'labels.rename',
      from: '1절',
      to: '새 절',
    });
    for (const document of documents.values()) {
      expect(document.song.groups[0]?.name).toBe('새 절');
    }
    expect(session.history.snapshot.song.groups[0]?.name).toBe('새 절');
    expect(screen.getByRole('button', {name: '새 절'})).toBeDefined();
  });

  it('keeps legacy label keys stored without displaying or editing them', async () => {
    const {user, labels} = await editorSetup();
    const menu = await openMenu(user);
    const row = within(menu).getByRole('menuitemradio', {name: '후렴'});
    expect(row.textContent).toBe('후렴');
    fireEvent.contextMenu(row);
    const management = screen.getByRole('menu', {name: '후렴 관리'});
    expect(
      within(management).queryByRole('menuitem', {name: '바로 가기 키'}),
    ).toBeNull();
    expect(
      within(management).getByRole('menuitem', {name: '이름 바꾸기'}),
    ).toBeDefined();
    expect(
      within(management).getByRole('menuitem', {name: '삭제'}),
    ).toBeDefined();
    await user.keyboard('{Escape}');
    await user.click(within(menu).getByRole('radio', {name: '초록'}));
    await waitFor(() => expect(labels().value.labels[0]?.color).toBe('green'));
    expect(labels().value.labels[1]?.key).toBe('KeyC');
  });
  it('deletes only the definition, keeping the song label without color', async () => {
    const {user, labels, session} = await editorSetup();
    await openMenu(user);
    fireEvent.contextMenu(screen.getByRole('menuitemradio', {name: '1절'}));
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    const confirmation = screen.getByRole('alertdialog');
    expect(
      within(confirmation).getByText('모든 곡의 이름표 유지'),
    ).toBeDefined();
    expect(
      document.getElementById(
        confirmation.getAttribute('aria-describedby') ?? '',
      )?.textContent,
    ).toContain('모든 곡의 이름표 유지');
    expect(labels().value.labels).toHaveLength(2);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() => expect(labels().value.labels).toHaveLength(1));
    expect(session.history.snapshot.song.groups[0]?.name).toBe('1절');
    expect(
      screen.getByRole('button', {name: '1절'}).getAttribute('data-color'),
    ).toBe('none');
  });

  it('supports arrow navigation, Escape, and outside focus without taking it back', async () => {
    const {user} = await editorSetup();
    await openMenu(user);
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', {name: '1절'}),
    );
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', {name: /후렴/}),
    );
    await user.keyboard('1');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', {name: '1절'}),
    );
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
