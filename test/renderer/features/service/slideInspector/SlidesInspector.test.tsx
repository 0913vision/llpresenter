import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {createServiceItemId, createSlideId} from '@core/schema/ids';
import {newSlidesItem, SlidesDraft} from '@core/services/slidesEdits';
import {newSectionCard} from '@core/services/sectionCards';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {SlidesListSession} from '@renderer/features/service/slides/slidesListSession';
import {SlidesInspector} from '@renderer/features/service/slideInspector/SlidesInspector';
import {useContext, useLayoutEffect, useRef} from 'react';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';

const stores: SongEditorStore[] = [];
function editorStore(): SongEditorStore {
  const store = new SongEditorStore(editorFixture().api, vi.fn());
  stores.push(store);
  return store;
}
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.dispose()));
});
vi.mock('@renderer/features/service/items/useItemSources', () => ({
  useItemMedia: () => ({document: null}),
}));
vi.mock('@renderer/features/bible/useSlidesVerseProjection', () => ({
  useSlidesVerseProjection: () => ({projection: null}),
}));
vi.mock('@renderer/features/service/slides/SlidesVisuals', () => ({
  useSlidesAppearance: () => ({appearance: {}, ready: true}),
  useSlidesItemWithBackground: (item: unknown) => item,
  slideBand: (slide: {text: string}) => slide.text,
  SlidesCanvas: ({
    item,
    index,
  }: {
    item: {slides: {slides: ReadonlyArray<{text: string}>}};
    index: number;
  }) => {
    const ready = useContext(PictureReadiness);
    const source = useRef({});
    useLayoutEffect(() => {
      ready?.(source.current);
    }, [ready]);
    return <div data-testid="picture">{item.slides.slides[index]?.text}</div>;
  },
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
  const view = render(
    <SlidesInspector
      api={mockLlpApi()}
      store={editorStore()}
      session={session}
    />,
  );
  const panel = within(view.container);
  const user = userEvent.setup();
  expect(panel.getByTestId('picture').textContent).toBe('첫 장');
  const second = slides[1];
  if (second === undefined) throw new Error('Missing second slide');
  act(() => session.selectSlides({type: 'click', id: second.id, ctrl: true}));
  expect(panel.getByTestId('picture').textContent).toBe('둘째 장');
  await user.click(panel.getByRole('button', {name: '이름표'}));
  await user.click(await screen.findByRole('menuitemradio', {name: '1절'}));
  expect(draft.snapshot.item.slides.slides.map(slide => slide.label)).toEqual([
    '1절',
    '1절',
  ]);
  act(() => session.edit('undo'));
  expect(draft.snapshot.item.slides.slides.map(slide => slide.label)).toEqual([
    undefined,
    undefined,
  ]);
  expect(panel.getByLabelText('전환 시간')).toHaveProperty(
    'placeholder',
    '혼합',
  );
  await user.click(panel.getByRole('button', {name: '디졸브'}));
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
  const view = render(
    <SlidesInspector
      api={mockLlpApi()}
      store={editorStore()}
      session={session}
    />,
  );
  const panel = within(view.container);
  expect(panel.getByTestId('picture').textContent).toBe('WELCOME');
  await userEvent.click(panel.getByRole('button', {name: '밀어내기'}));
  expect(draft.snapshot.item.slides.slides[0]?.transition?.kind).toBe('push');
});

it('applies one transition to a selected section card and slide and undoes both', async () => {
  const item = newSlidesItem(
    'blank',
    createServiceItemId('00000000-0000-4000-8000-000000000199'),
  );
  const draft = new SlidesDraft({...item, sectionCard: newSectionCard()});
  const session = new SlidesListSession(draft, {
    locked: () => false,
    problem: vi.fn(),
  });
  const view = render(
    <SlidesInspector
      api={mockLlpApi()}
      store={editorStore()}
      session={session}
      cardSelected
    />,
  );
  await userEvent.click(
    within(view.container).getByRole('button', {
      name: '\uB514\uC878\uBE0C',
    }),
  );
  expect(draft.snapshot.item.sectionCard?.transition?.kind).toBe('dissolve');
  expect(draft.snapshot.item.slides.slides[0]?.transition?.kind).toBe(
    'dissolve',
  );
  act(() => session.edit('undo'));
  expect(draft.snapshot.item.sectionCard?.transition).toBeUndefined();
  expect(draft.snapshot.item.slides.slides[0]?.transition).toBeUndefined();
});
