import {describe, expect, it} from 'vitest';
import {
  createMediaId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {
  detailsHeading,
  detailsKindLine,
  sectionItemCount,
} from '@renderer/features/service/details/detailsHeading';
import {newSlidesItem} from '@core/services/slidesEdits';
import {newSectionCard} from '@core/services/sectionCards';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';

const first = createServiceItemId('00000000-0000-4000-8000-000000000101');
const second = createServiceItemId('00000000-0000-4000-8000-000000000102');
const itemId = createServiceItemId('00000000-0000-4000-8000-000000000103');
const missing = createServiceItemId('00000000-0000-4000-8000-000000000104');
const header = (id: typeof first): ServiceItem => ({id, header: 'Section'});
const item: ServiceItem = {
  id: itemId,
  media: createMediaId('00000000-0000-4000-8000-000000000105'),
};

describe('sectionItemCount', () => {
  it('counts only items before the next header', () => {
    expect(
      sectionItemCount([header(first), item, header(second), item], first),
    ).toBe(1);
  });
  it('returns zero for a header at the end', () => {
    expect(sectionItemCount([item, header(first)], first)).toBe(0);
  });
  it('returns zero for consecutive headers', () => {
    expect(sectionItemCount([header(first), header(second), item], first)).toBe(
      0,
    );
  });
  it('returns zero for a missing id or a non-header id', () => {
    expect(sectionItemCount([header(first), item], missing)).toBe(0);
    expect(sectionItemCount([header(first), item], itemId)).toBe(0);
  });
});

it('formats the kind line for every item kind and a library song', () => {
  const blank = newSlidesItem('blank', itemId);
  const ad = newSlidesItem('ad', itemId);
  const song = {
    id: itemId,
    song: createSongId('00000000-0000-4000-8000-000000000106'),
    slides: [],
  };
  const passage = panelPassage();
  const bible = {
    id: itemId,
    bible: {
      translation: passage.translation,
      ref: passage.ref,
      split: 'verse' as const,
      reference: 'every' as const,
      verseNumbers: true,
      translationName: false,
    },
  };
  const card = {
    ...blank,
    sectionCard: newSectionCard(),
    slides: {...blank.slides, slides: []},
  };
  const mixed = {...blank, sectionCard: newSectionCard()};
  const cases = [
    {
      item: blank,
      rawCount: 0,
      offset: 0,
      expected: `슬라이드 ${blank.slides.slides.length}개`,
    },
    {item: card, rawCount: 0, offset: 1, expected: '구역 이름'},
    {
      item: mixed,
      rawCount: 0,
      offset: 1,
      expected: `슬라이드 ${mixed.slides.slides.length + 1}개`,
    },
    {
      item: ad,
      rawCount: 0,
      offset: 0,
      expected: `광고, 슬라이드 ${ad.slides.slides.length}개`,
    },
    {item: song, rawCount: 6, offset: 0, expected: '곡, 슬라이드 6개'},
    {item: bible, rawCount: 3, offset: 0, expected: '성경, 슬라이드 3개'},
    {item, rawCount: 1, offset: 0, expected: '미디어, 슬라이드 1개'},
  ];
  for (const example of cases) {
    const {kind, count} = detailsHeading({
      item: example.item,
      song: null,
      library: null,
      rawCount: example.rawCount,
      offset: example.offset,
      mediaTitle: undefined,
    });
    expect(detailsKindLine(example.item, kind, count)).toBe(example.expected);
  }
  const library = {
    songId: song.song,
    songRevision: 1,
    title: 'Song',
    readOnly: false,
    tiles: [],
    jumpKeys: {},
  };
  const heading = detailsHeading({
    item: null,
    song: null,
    library,
    rawCount: 0,
    offset: 0,
    mediaTitle: undefined,
  });
  expect(detailsKindLine(null, heading.kind, heading.count)).toBe(
    '곡, 슬라이드 0개',
  );
});
