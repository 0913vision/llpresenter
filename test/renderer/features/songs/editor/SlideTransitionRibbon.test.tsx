import {act, fireEvent, screen, within} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {editorSong} from '@fixtures/renderer/features/songs/editor/editorFixture';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

it('disables every transition edit for a read-only song', async () => {
  const {store, user} = await editorSetup();
  act(() => store.open(editorSong(3, 'readOnly')));
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing read-only session');
  const before = session.history.snapshot;
  const controls = within(screen.getByRole('group', {name: '슬라이드 전환'}));
  for (const button of controls.getAllByRole('button')) {
    expect(button.matches(':disabled, [aria-disabled="true"]')).toBe(true);
    await user.click(button);
  }
  expect(controls.getByRole('spinbutton')).toHaveProperty('disabled', true);
  expect(session.history.snapshot).toBe(before);
});

it('edits Shift/Ctrl selections, marks explicit cuts, restores defaults and applies all in one undo step', async () => {
  const {session, user} = await editorSetup();
  const rows = [
    ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
  ];
  const first = rows[0],
    last = rows[1];
  if (!first || !last) throw new Error('Missing rows');
  const controls = within(screen.getByRole('group', {name: '슬라이드 전환'}));
  const time = controls.getByRole('spinbutton');
  expect(time).toHaveProperty('disabled', true);
  fireEvent.click(first);
  fireEvent.click(last, {shiftKey: true});
  await user.click(controls.getByRole('button', {name: '닦아내기'}));
  expect(
    session.history.snapshot.song.slides.every(
      slide => slide.transition?.kind === 'wipe',
    ),
  ).toBe(true);
  expect(screen.getAllByRole('img', {name: '개별 전환 설정'})).toHaveLength(2);
  await user.keyboard('{Control>}z{/Control}');
  expect(
    session.history.snapshot.song.slides.every(
      slide => slide.transition === undefined,
    ),
  ).toBe(true);
  await user.keyboard('{Control>}y{/Control}');
  await user.clear(time);
  await user.type(time, '4{Enter}');
  expect(
    session.history.snapshot.song.slides.every(
      slide => slide.transition?.sec === 4,
    ),
  ).toBe(true);
  fireEvent.click(first, {ctrlKey: true});
  expect(session.slideModel.getSnapshot().selection.ids.size).toBe(1);
  await user.click(controls.getByRole('button', {name: '없음'}));
  expect(time).toHaveProperty('disabled', true);
  expect(screen.getAllByRole('img', {name: '개별 전환 설정'})).toHaveLength(2);
  await user.click(controls.getByRole('button', {name: '이 곡 전체에 적용'}));
  expect(
    session.history.snapshot.song.slides.every(
      slide => slide.transition?.kind === 'none',
    ),
  ).toBe(true);
  await user.keyboard('{Control>}z{/Control}');
  expect(
    session.history.snapshot.song.slides.map(slide => slide.transition?.kind),
  ).toEqual(['wipe', 'none']);
  fireEvent.click(first, {ctrlKey: true});
  expect(
    screen.getByText('선택한 슬라이드의 효과가 서로 다릅니다.'),
  ).not.toBeNull();
  const applyAll = controls.getByRole('button', {name: '이 곡 전체에 적용'});
  expect(applyAll.getAttribute('aria-disabled')).toBe('true');
  const before = session.history.snapshot;
  await user.click(applyAll);
  expect(session.history.snapshot).toBe(before);
  await user.click(controls.getByRole('button', {name: '기본값'}));
  expect(
    session.history.snapshot.song.slides.every(
      slide => !('transition' in slide),
    ),
  ).toBe(true);
  expect(screen.queryByRole('img', {name: '개별 전환 설정'})).toBeNull();
});
