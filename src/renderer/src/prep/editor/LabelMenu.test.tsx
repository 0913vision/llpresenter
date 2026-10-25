import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorFixture} from './editorFixture';
import {editorSetup, lyrics} from './editorTesting';

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
    expect(session.history.snapshot.song.slides[0]?.label).toBe('후렴');
  });
  it('chooses a label, removes it, and returns focus without stealing it on save pushes', async () => {
    const {user, session} = await editorSetup();
    await openMenu(user);
    await user.click(screen.getByRole('menuitemradio', {name: /후렴/}));
    await act(() => session.flush());
    expect(session.history.snapshot.song.slides[0]?.label).toBe('후렴');
    expect(document.activeElement).toBe(
      screen.getAllByRole('button', {name: '후렴'})[0],
    );
    await user.click(
      screen.getAllByRole('button', {name: '후렴'})[0] ?? document.body,
    );
    await user.click(screen.getByRole('menuitemradio', {name: '이름표 없음'}));
    expect(session.history.snapshot.song.slides[0]?.label).toBe('');
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
    expect(session.history.snapshot.song.slides[0]?.label).toBe('끝');
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
      expect(document.song.slides[0]?.label).toBe('새 절');
    }
    expect(session.history.snapshot.song.slides[0]?.label).toBe('새 절');
    expect(screen.getByRole('button', {name: '새 절'})).toBeDefined();
  });

  it('records a physical letter and warns on both conflicting rows', async () => {
    const {user, labels} = await editorSetup();
    await openMenu(user);
    const dialog = await manage('1절', '바로 가기 키');
    const field = within(dialog).getByRole('textbox', {name: '바로 가기 키'});
    expect(field.hasAttribute('data-shortcut-recording')).toBe(true);
    fireEvent.keyDown(field, {key: 'ㅊ', code: 'KeyC'});
    expect(field.getAttribute('value')).toBe('C');
    await user.click(within(dialog).getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(labels().value.labels[0]?.key).toBe('KeyC');
    expect(screen.getAllByRole('img', {name: /겹침/})).toHaveLength(2);
  });

  it('rejects modifiers and nonletter keys and clears a jump key', async () => {
    const {user, labels} = await editorSetup();
    await openMenu(user);
    const dialog = await manage('1절', '바로 가기 키');
    const field = within(dialog).getByRole('textbox', {name: '바로 가기 키'});
    fireEvent.keyDown(field, {key: 'F1', code: 'F1'});
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC', ctrlKey: true});
    expect(field.getAttribute('value')).toBe('');
    fireEvent.keyDown(field, {key: '1', code: 'Digit1'});
    expect(field.getAttribute('value')).toBe('1');
    fireEvent.keyDown(field, {key: 'Backspace', code: 'Backspace'});
    await user.click(within(dialog).getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(labels().value.labels[0]?.key).toBeNull();
  });

  it('normalizes numpad digits only with Num Lock and ignores an IME recording key', async () => {
    const {user, labels} = await editorSetup();
    await openMenu(user);
    const dialog = await manage('1절', '바로 가기 키');
    const field = within(dialog).getByRole('textbox', {name: '바로 가기 키'});
    fireEvent.keyDown(field, {key: 'a', code: 'KeyA', isComposing: true});
    expect(field.getAttribute('value')).toBe('');
    fireEvent.keyDown(field, {key: 'End', code: 'Numpad1'});
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const event = new KeyboardEvent('keydown', {
      key: '1',
      code: 'Numpad1',
      bubbles: true,
    });
    Object.defineProperty(event, 'getModifierState', {
      value: (modifier: string) => modifier === 'NumLock',
    });
    fireEvent(field, event);
    await user.click(within(dialog).getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(labels().value.labels[0]?.key).toBe('Digit1');
  });

  it('deletes only the definition, keeping the song label without color', async () => {
    const {user, labels, session} = await editorSetup();
    await openMenu(user);
    fireEvent.contextMenu(screen.getByRole('menuitemradio', {name: '1절'}));
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    expect(labels().value.labels).toHaveLength(2);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() => expect(labels().value.labels).toHaveLength(1));
    expect(session.history.snapshot.song.slides[0]?.label).toBe('1절');
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
