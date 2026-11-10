import {act, render, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {createServiceItemId, createSlideId} from '@core/schema/ids';
import {newSlidesItem, SlidesDraft} from '@core/services/slidesEdits';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SlidesListSession} from '@renderer/features/service/slides/slidesListSession';
import {SlidesInspector} from '@renderer/features/service/slideInspector/SlidesInspector';
vi.mock('@renderer/features/service/items/useItemSources', () => ({
  useItemMedia: () => ({document: null}),
}));
vi.mock('@renderer/features/bible/useSlidesVerseProjection', () => ({
  useSlidesVerseProjection: () => ({projection: null}),
}));
vi.mock('@renderer/features/service/slides/SlidesVisuals', () => ({
  useSlidesAppearance: () => ({appearance: {}}),
  useSlidesItemWithBackground: (item: unknown) => item,
  slideBand: (slide: {text: string}) => slide.text,
  SlidesCanvas: ({
    item,
    index,
  }: {
    item: {slides: {slides: ReadonlyArray<{text: string}>}};
    index: number;
  }) => <div data-testid="picture">{item.slides.slides[index]?.text}</div>,
}));
it('tracks slide item selection and applies mixed transition edits', async () => {
  const item = newSlidesItem(
    'blank',
    createServiceItemId('00000000-0000-4000-8000-000000000111'),
  );
  const slides = [
    {
      id: createSlideId('00000000-0000-4000-8000-000000000112'),
      text: '첫 장',
      transition: {kind: 'push' as const, sec: 1, dir: 'left' as const},
    },
    {
      id: createSlideId('00000000-0000-4000-8000-000000000113'),
      text: '둘째 장',
    },
  ];
  const draft = new SlidesDraft({...item, slides: {...item.slides, slides}});
  const session = new SlidesListSession(draft, {
    locked: () => false,
    problem: vi.fn(),
  });
  const view = render(<SlidesInspector api={mockLlpApi()} session={session} />);
  const panel = within(view.container);
  const user = userEvent.setup();
  expect(panel.getByTestId('picture').textContent).toBe('첫 장');
  const second = slides[1];
  if (second === undefined) throw new Error('Missing second slide');
  act(() => session.selectSlides({type: 'click', id: second.id, ctrl: true}));
  expect(panel.getByTestId('picture').textContent).toBe('둘째 장');
  expect(panel.getByLabelText('전환 시간')).toHaveProperty(
    'placeholder',
    '혼합',
  );
  await user.click(panel.getByLabelText('효과'));
  await user.click(
    within(document.body).getByRole('menuitemradio', {name: '디졸브'}),
  );
  expect(
    draft.snapshot.item.slides.slides.every(
      slide => slide.transition?.kind === 'dissolve',
    ),
  ).toBe(true);
  act(() => session.selectSlides({type: 'clear'}));
  expect(panel.queryByTestId('picture')).toBeNull();
  expect(panel.queryByLabelText('효과')).toBeNull();
});

it('shows the picture and transition control for a card-only slide item', async () => {
  const item = newSlidesItem(
    'blank',
    createServiceItemId('00000000-0000-4000-8000-000000000121'),
  );
  const draft = new SlidesDraft({
    ...item,
    slides: {
      ...item.slides,
      name: '구역 이름',
      slides: [
        {
          id: createSlideId('00000000-0000-4000-8000-000000000122'),
          text: 'WELCOME',
        },
      ],
    },
  });
  const session = new SlidesListSession(draft, {
    locked: () => false,
    problem: vi.fn(),
  });
  const view = render(<SlidesInspector api={mockLlpApi()} session={session} />);
  const panel = within(view.container);
  expect(panel.getByTestId('picture').textContent).toBe('WELCOME');
  await userEvent.click(panel.getByLabelText('효과'));
  await userEvent.click(
    within(document.body).getByRole('menuitemradio', {name: '밀어내기'}),
  );
  expect(draft.snapshot.item.slides.slides[0]?.transition?.kind).toBe('push');
});
