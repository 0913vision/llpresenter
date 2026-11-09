import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';

vi.mock('@renderer/platform/useSettingsDocument', () => ({
  useSettingsDocument: () => null,
}));
vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: ({layers}: {layers: {slide: {lines: string[]} | null}}) => (
    <div data-testid="picture">{layers.slide?.lines.join(' ')}</div>
  ),
}));

it.each(['list', 'grid'] as const)(
  'reflects a %s surface selection in the inspector',
  async mode => {
    seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
    const {store, session, view} = await editorSetup();
    const inspector = render(<SlideInspector store={store} />);
    try {
      const second = view.container.querySelector<HTMLElement>(
        '[data-editor-block="1"]',
      );
      if (second === null) throw new Error('Missing second slide');
      fireEvent.click(second);
      const expected = session.history.snapshot.song.slides[1];
      if (expected === undefined) throw new Error('Missing slide data');
      expect(
        within(inspector.container).getByTestId('picture').textContent,
      ).toBe(expected.lines.join(' '));
    } finally {
      inspector.unmount();
      seedSlideSurfaceView({});
    }
  },
);

it('updates its local picture as the selected lyrics change', async () => {
  const {store, session} = await editorSetup();
  const view = render(<SlideInspector store={store} />);
  const picture = within(view.container).getByTestId('picture');
  act(() =>
    session.edit({type: 'text', text: '새로운 가사', start: 6, end: 6}),
  );
  expect(picture.textContent).toContain('새로운 가사');
  view.unmount();
});

it('edits the selected slides and shows mixed transitions', async () => {
  const {store, session, user} = await editorSetup();
  const view = render(<SlideInspector store={store} />);
  const panel = within(view.container);
  const effect = panel.getByLabelText('효과');
  await user.click(effect);
  await user.click(
    within(document.body).getByRole('menuitemradio', {name: '닦아내기'}),
  );
  expect(session.history.snapshot.song.slides[0]?.transition?.kind).toBe(
    'wipe',
  );
  const second = session.slideModel.getSnapshot().slides[1];
  if (!second) throw new Error('Missing second slide');
  act(() => session.selectSlides({type: 'click', id: second.id, ctrl: true}));
  expect(effect.textContent).toBe('혼합');
  const time = panel.getByLabelText('전환 시간');
  expect(time).toHaveProperty('value', '');
  expect(time).toHaveProperty('placeholder', '혼합');
  await user.clear(time);
  await user.type(time, '2{Enter}');
  expect(
    session.history.snapshot.song.slides.map(slide => slide.transition),
  ).toEqual([{kind: 'wipe', sec: 2, dir: 'left'}, undefined]);
  fireEvent.keyDown(time, {key: 'z', ctrlKey: true});
  expect(session.history.snapshot.song.slides[0]?.transition?.sec).toBe(0.5);
  fireEvent.keyDown(time, {key: 'y', ctrlKey: true});
  expect(session.history.snapshot.song.slides[0]?.transition?.sec).toBe(2);
  await user.click(effect);
  await user.click(
    within(document.body).getByRole('menuitemradio', {name: '디졸브'}),
  );
  expect(
    session.history.snapshot.song.slides.map(slide => slide.transition?.kind),
  ).toEqual(['dissolve', 'dissolve']);
  expect(panel.getByText('이 곡 전체에 적용')).toBeTruthy();
  view.unmount();
});

it('applies a label choice to each selected slide', async () => {
  const {store, session, user} = await editorSetup();
  const view = render(<SlideInspector store={store} />);
  const second = session.slideModel.getSnapshot().slides[1];
  if (!second) throw new Error('Missing second slide');
  act(() => session.selectSlides({type: 'click', id: second.id, ctrl: true}));
  await user.click(within(view.container).getByRole('button', {name: '혼합'}));
  await user.click(
    within(document.body).getByRole('menuitemradio', {name: '1절'}),
  );
  expect(
    session.history.snapshot.song.slides.map(slide => slide.label),
  ).toEqual(['1절', '1절']);
  view.unmount();
});

it('opens the hot key recorder from the inspector and saves the selected key', async () => {
  const {store, session, user} = await editorSetup();
  const view = render(<SlideInspector store={store} />);
  await user.click(within(view.container).getByRole('button', {name: '설정…'}));
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 단축키'}), {
    key: 'a',
    code: 'KeyA',
  });
  await user.click(screen.getByRole('button', {name: '저장'}));
  expect(session.history.snapshot.song.slides[0]?.hotKey).toBe('KeyA');
  view.unmount();
});

it('treats omitted direction and left as the same transition', async () => {
  const {store, session} = await editorSetup();
  const slides = session.slideModel.getSnapshot().slides;
  const first = slides[0],
    second = slides[1];
  if (!first || !second) throw new Error('Missing slides');
  act(() => {
    session.commandSlides({
      type: 'transition',
      transition: {kind: 'push', sec: 1},
    });
    session.selectSlides({type: 'click', id: second.id});
    session.commandSlides({
      type: 'transition',
      transition: {kind: 'push', dir: 'left', sec: 1},
    });
    session.selectSlides({type: 'click', id: first.id, ctrl: true});
  });
  const view = render(<SlideInspector store={store} />);
  expect(within(view.container).getByLabelText('효과').textContent).toBe(
    '밀어내기',
  );
  view.unmount();
});
