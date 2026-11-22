import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {beforeEach, expect, it, onTestFinished, vi} from 'vitest';
import {translationIdSchema} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {liturgyItem, withOpeningTitle} from '@core/slides/items';
import {defaultSlideTransitions} from '@core/schema/preferences';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  installPassageSplitter,
  PassageSplitter,
} from '@renderer/features/bible/passageSplitter';
import {useItemEditor} from '@renderer/features/service/editor/useItemEditor';
import {seedSlideSurfaceView} from '@renderer/features/slides/SlideSurfaceView';
import {useThemes} from '@renderer/platform/themes';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {
  itemId,
  openServiceFixture,
} from '@fixtures/renderer/session/openServiceFixture';
import * as v from 'valibot';

const ITEM = itemId(1);
const SAMPLE = v.parse(translationIdSchema, 'sample');
const report = vi.fn();
const back = vi.fn();
const making = {themes: themes(), transitions: defaultSlideTransitions};

function Harness(): JSX.Element {
  const editor = useItemEditor({itemId: ITEM, report, onBack: back});
  return (
    <>
      {editor?.editor}
      {editor?.inspector}
    </>
  );
}

function open(item: ServiceItem) {
  const service = openServiceFixture([item], {
    api: {bible: {lookup: formLookupReply}},
  });
  const slides = () => {
    const current = service.item(ITEM);
    return current !== undefined && 'slides' in current ? current.slides : [];
  };
  render(<Harness />);
  return {...service, slides};
}

/** Measures every character as 40 wide. */
const canvas = {
  font: '',
  measureText: (text: string) => ({width: Array.from(text).length * 40}),
};

beforeEach(() => {
  report.mockReset();
  back.mockReset();
  useThemes.setState({themes: themes(), screens: themeScreens});
  seedSlideSurfaceView({layout: {normal: {editorSlideView: 'list'}}});
});

it('saves what is typed into a slide of the item', async () => {
  const {slides} = open({
    id: ITEM,
    kind: 'notice',
    name: '광고',
    slides: [slideOf(1, 'notice', {texts: {제목: '모임', 내용: '주일 오후'}})],
  });
  const title = screen.getAllByRole('textbox', {name: '제목'})[0];
  if (title === undefined) throw new Error('Missing field');
  await userEvent.type(title, ' 안내');
  await waitFor(() => expect(slides()[0]?.texts['제목']).toBe('모임 안내'));
});

it('renames an item of its own name, and not a song', async () => {
  const {item} = open({
    id: ITEM,
    kind: 'blank',
    name: '빈 슬라이드',
    slides: [],
  });
  const name = screen.getByRole('textbox', {name: '이름'});
  fireEvent.change(name, {target: {value: '입장'}});
  fireEvent.blur(name);
  await waitFor(() => expect(item(ITEM)?.name).toBe('입장'));
});

it('has the name of a song only to read', () => {
  open({
    id: ITEM,
    kind: 'song',
    name: '새 노래',
    slides: [lyricsSlide(1, '가사')],
  });
  expect(
    screen.getByRole<HTMLInputElement>('textbox', {name: '이름'}).readOnly,
  ).toBe(true);
  expect(screen.getByRole('button', {name: '라이브러리에 저장…'})).toBeTruthy();
});

it('adds the title of an item at its start, once', async () => {
  const {slides} = open({
    id: ITEM,
    kind: 'blank',
    name: '찬양',
    slides: [slideOf(1, 'blank')],
  });
  await userEvent.click(screen.getByRole('button', {name: '타이틀'}));
  await waitFor(() => expect(slides()).toHaveLength(2));
  expect(slides()[0]?.theme).toBe(BUILT_IN_THEME_IDS.title);
  expect(slides()[0]?.texts['제목']).toBe('찬양');
  expect(screen.queryByRole('button', {name: '타이틀'})).toBeNull();
});

it('changes the version of a creed and keeps its title', async () => {
  const creed = withOpeningTitle(
    making,
    {...liturgyItem(making, 'creed', 'new'), id: ITEM},
    {name: '사도신경', english: 'Apostles’ Creed'},
  );
  const {item, slides} = open(creed);
  const before = slides().length;
  await userEvent.click(screen.getByRole('button', {name: '예식문 버전'}));
  await userEvent.click(screen.getByRole('menuitemradio', {name: '옛 번역'}));
  await waitFor(() => expect(item(ITEM)).toMatchObject({translation: 'old'}));
  expect(slides()[0]?.theme).toBe(BUILT_IN_THEME_IDS.title);
  expect(slides().length).toBeGreaterThan(1);
  expect(before).toBeGreaterThan(1);
});

it('changes the passage of an item, cut to fit', async () => {
  onTestFinished(
    installPassageSplitter(
      new PassageSplitter({themes: themes(), saved: undefined, canvas}),
    ),
  );
  const {item, slides} = open({
    id: ITEM,
    kind: 'bible',
    name: '요한복음 3:16',
    passage: {
      translation: SAMPLE,
      ref: '요한복음 3:16',
      verseNumbers: true,
      translationName: false,
    },
    slides: [
      slideOf(1, 'scripture', {
        texts: {본문: '고친 글'},
        verse: {translation: SAMPLE, book: 43, chapter: 3, verse: 16},
      }),
    ],
  });
  await userEvent.click(screen.getByRole('button', {name: '본문 변경…'}));
  const dialog = within(screen.getByRole('dialog', {name: '성경 구절'}));
  const end = dialog.getByRole('textbox', {name: '끝절'});
  fireEvent.change(end, {target: {value: '18'}});
  fireEvent.keyDown(end, {key: 'Enter', code: 'Enter'});
  await waitFor(() =>
    expect(item(ITEM)).toMatchObject({
      name: '요한복음 3:16~18',
      passage: {ref: '요한복음 3:16-18'},
    }),
  );
  expect(new Set(slides().map(slide => slide.verse?.verse))).toEqual(
    new Set([16, 17, 18]),
  );
  expect(slides()[0]?.texts['본문']).toContain('고친 글');
});

it('says why a verse that was changed by hand cannot be cut', async () => {
  open({
    id: ITEM,
    kind: 'bible',
    name: '요한복음 3:16',
    passage: {
      translation: SAMPLE,
      ref: '요한복음 3:16',
      verseNumbers: false,
      translationName: false,
    },
    slides: [
      slideOf(1, 'scripture', {
        texts: {본문: '고친 글'},
        verse: {translation: SAMPLE, book: 43, chapter: 3, verse: 16},
      }),
    ],
  });
  const split = screen.getByRole('button', {name: '절 나누기'});
  expect(split.getAttribute('aria-disabled')).toBe('true');
  await userEvent.click(split);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('goes back to the service with its button', async () => {
  open({id: ITEM, kind: 'blank', name: '빈 슬라이드', slides: []});
  await userEvent.click(screen.getByRole('button', {name: '‹ 주일 예배'}));
  expect(back).toHaveBeenCalledOnce();
});
