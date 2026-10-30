import {act, fireEvent, screen, within} from '@testing-library/react';
import {expect, it} from 'vitest';
import {editorSong} from './editorFixture';
import {editorSetup, lyrics} from './editorTesting';

it('assigns the selected source slide through song persistence and undo', async () => {
  const {user, session, documents, first} = await editorSetup();
  await user.click(lyrics(2));
  await user.click(
    screen.getByRole('button', {name: '슬라이드 2 바로 가기 키'}),
  );
  const field = screen.getByRole('textbox', {name: '슬라이드 바로 가기 키'});
  fireEvent.keyDown(field, {key: 'ㅊ', code: 'KeyC'});
  await user.click(screen.getByRole('button', {name: '저장'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(
    screen.getByRole('button', {name: '슬라이드 2 바로 가기 키: C'}),
  ).toBeDefined();
  await act(() => session.flush());
  const saved = documents.get(first.song.id)?.song;
  expect(saved?.groups[0]?.slides[0]?.hotKey).toBeUndefined();
  expect(saved?.groups[1]?.slides[0]?.hotKey).toBe('KeyC');
  expect(saved?.arrangements).toEqual(first.song.arrangements);
  act(() => session.edit('undo'));
  await act(() => session.flush());
  expect(
    documents.get(first.song.id)?.song.groups[1]?.slides[0]?.hotKey,
  ).toBeUndefined();
  act(() => session.edit('redo'));
  await act(() => session.flush());
  expect(documents.get(first.song.id)?.song.groups[1]?.slides[0]?.hotKey).toBe(
    'KeyC',
  );
});

it('refuses a duplicate and exposes read-only access without changing the song', async () => {
  const {user, session, store} = await editorSetup();
  await user.click(
    screen.getByRole('button', {name: '슬라이드 1 바로 가기 키'}),
  );
  fireEvent.keyDown(
    screen.getByRole('textbox', {name: '슬라이드 바로 가기 키'}),
    {
      key: 'a',
      code: 'KeyA',
    },
  );
  await user.click(screen.getByRole('button', {name: '저장'}));
  await user.click(lyrics(2));
  await user.click(
    screen.getByRole('button', {name: '슬라이드 2 바로 가기 키'}),
  );
  const dialog = screen.getByRole('dialog');
  fireEvent.keyDown(
    within(dialog).getByRole('textbox', {name: '슬라이드 바로 가기 키'}),
    {
      key: 'a',
      code: 'KeyA',
    },
  );
  expect(
    within(dialog)
      .getByRole('button', {name: '저장'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  expect(
    session.history.snapshot.song.groups[1]?.slides[0]?.hotKey,
  ).toBeUndefined();
  await user.keyboard('{Escape}');
  act(() => store.open(editorSong(5, 'readOnly')));
  expect(
    screen
      .getByRole('button', {name: '슬라이드 1 바로 가기 키'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
});

it('does not apply a draft when its source song changes while the dialog is open', async () => {
  const {user, session} = await editorSetup();
  await user.click(
    screen.getByRole('button', {name: '슬라이드 1 바로 가기 키'}),
  );
  const field = screen.getByRole('textbox', {name: '슬라이드 바로 가기 키'});
  fireEvent.keyDown(field, {key: 'a', code: 'KeyA'});
  act(() =>
    session.edit({type: 'text', text: 'Updated words', start: 0, end: 0}),
  );
  expect(
    screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
  ).toBe('true');
  await user.click(screen.getByRole('button', {name: '저장'}));
  expect(
    session.history.snapshot.song.groups[0]?.slides[0]?.hotKey,
  ).toBeUndefined();
  expect(screen.getByRole('dialog')).toBeDefined();
});
