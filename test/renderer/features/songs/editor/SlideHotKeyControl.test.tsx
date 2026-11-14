import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';

vi.mock('@renderer/platform/useSettingsDocument', () => ({
  useSettingsDocument: () => null,
  useApiSettingsDocument: () => null,
}));
vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: () => <div />,
}));

async function setup() {
  const fixture = await editorSetup();
  const inspector = render(<SlideInspector store={fixture.store} />);
  const open = async (index: number) => {
    const slide = fixture.session.slideModel.getSnapshot().slides[index];
    if (slide === undefined) throw Error('Missing slide');
    act(() => fixture.session.selectSlides({type: 'click', id: slide.id}));
    await fixture.user.click(
      within(inspector.container).getByRole('button', {name: '설정…'}),
    );
  };
  return {...fixture, inspector, open};
}

function key(code: string) {
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 단축키'}), {
    key: code.slice(-1).toLowerCase(),
    code,
  });
}

it('persists the selected slide key through undo and redo', async () => {
  const {user, session, documents, first, open} = await setup();
  await open(1);
  expect(session.history.snapshot.selection.block).toBe(1);
  key('KeyC');
  await user.click(screen.getByRole('button', {name: '저장'}));
  await act(() => session.flush());
  expect(
    documents.get(first.song.id)?.song.slides.map(slide => slide.hotKey),
  ).toEqual([undefined, 'KeyC']);
  act(() => session.edit('undo'));
  await act(() => session.flush());
  expect(documents.get(first.song.id)?.song.slides[1]?.hotKey).toBeUndefined();
  act(() => session.edit('redo'));
  await act(() => session.flush());
  expect(documents.get(first.song.id)?.song.slides[1]?.hotKey).toBe('KeyC');
});

it('refuses a key already assigned to another slide', async () => {
  const {user, session, open} = await setup();
  await open(0);
  key('KeyA');
  await user.click(screen.getByRole('button', {name: '저장'}));
  await open(1);
  key('KeyA');
  expect(
    screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
  ).toBe('true');
  expect(session.history.snapshot.song.slides[1]?.hotKey).toBeUndefined();
});

it('does not apply a key draft after the source song changes', async () => {
  const {user, session, open} = await setup();
  await open(0);
  key('KeyA');
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
