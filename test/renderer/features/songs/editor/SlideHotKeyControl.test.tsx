import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it} from 'vitest';
import {editorSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {SongSlidePanel} from '@renderer/features/songs/editor/SongSlidePanel';

async function setup() {
  const fixture = await editorSetup();
  render(<SongSlidePanel store={fixture.store} sizeClass="normal" />);
  return fixture;
}

async function keyMenu(number: number): Promise<HTMLElement> {
  const grid = screen.getByRole('listbox', {name: '슬라이드'});
  const tile = within(grid).getAllByRole('option')[number - 1];
  if (!tile) throw new Error('Missing thumbnail');
  fireEvent.contextMenu(tile);
  expect(tile.hasAttribute('data-menu-target')).toBe(true);
  return screen.getByRole('menuitem', {name: '단축키…'});
}

it('assigns the clicked source slide through the shared menu, persistence and undo', async () => {
  const {user, session, documents, first} = await setup();
  expect(screen.queryByRole('button', {name: /슬라이드.*단축키/})).toBeNull();
  await user.click(await keyMenu(2));
  expect(session.history.snapshot.selection.block).toBe(1);
  expect(
    within(screen.getByRole('listbox', {name: '슬라이드'}))
      .getAllByRole('option')[1]
      ?.getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 단축키'}), {
    key: 'ㅊ',
    code: 'KeyC',
  });
  await user.click(screen.getByRole('button', {name: '저장'}));
  await act(() => session.flush());
  const saved = documents.get(first.song.id)?.song;
  expect(saved?.slides[0]?.hotKey).toBeUndefined();
  expect(saved?.slides[1]?.hotKey).toBe('KeyC');
  act(() => session.edit('undo'));
  await act(() => session.flush());
  expect(documents.get(first.song.id)?.song.slides[1]?.hotKey).toBeUndefined();
  act(() => session.edit('redo'));
  await act(() => session.flush());
  expect(documents.get(first.song.id)?.song.slides[1]?.hotKey).toBe('KeyC');
});

it('refuses duplicate keys and disables the read-only menu entry', async () => {
  const {user, session, store} = await setup();
  await user.click(await keyMenu(1));
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 단축키'}), {
    key: 'a',
    code: 'KeyA',
  });
  await user.click(screen.getByRole('button', {name: '저장'}));
  await user.click(await keyMenu(2));
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 단축키'}), {
    key: 'a',
    code: 'KeyA',
  });
  expect(
    screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(session.history.snapshot.song.slides[1]?.hotKey).toBeUndefined();
  await user.keyboard('{Escape}');
  act(() => store.open(editorSong(5, 'readOnly')));
  expect((await keyMenu(1)).getAttribute('aria-disabled')).toBe('true');
});

it('does not apply a key draft after the source song changes', async () => {
  const {user, session} = await setup();
  await user.click(await keyMenu(1));
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 단축키'}), {
    key: 'a',
    code: 'KeyA',
  });
  act(() =>
    session.edit({type: 'text', text: 'Updated words', start: 0, end: 0}),
  );
  expect(
    screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
  ).toBe('true');
  await user.click(screen.getByRole('button', {name: '저장'}));
  expect(session.history.snapshot.song.slides[0]?.hotKey).toBeUndefined();
  expect(screen.getByRole('dialog')).toBeDefined();
});
