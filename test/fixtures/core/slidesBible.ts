import {createSlideId, translationIdSchema} from '@core/schema/ids';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {SlidesItem} from '@core/services/slidesEdits';
import {testId} from './schema/testHelpers';
import {MOCK_LONG_VERSE} from './bibleSplit';
import {slidesItem} from './slides';
import {projectSlides} from '@core/presentation/slides';
import type {ShowTile} from '@core/schema/showService';

export const VERSE_SLIDE = createSlideId(
  '00000000-0000-4000-8000-000000000911',
);
export const VERSE_REPEAT = createSlideId(
  '00000000-0000-4000-8000-000000000912',
);
export const VERSE_NEXT = createSlideId('00000000-0000-4000-8000-000000000913');
export const SLIDES_PASSAGE: BibleLookupPassage = {
  translation: testId(translationIdSchema, 'sample'),
  ref: '요한복음 3:16-17',
  displayRef: '요한복음 3:16~17',
  verses: [
    {chapter: 3, verse: 16, text: MOCK_LONG_VERSE},
    {chapter: 3, verse: 17, text: '새가 노래한다'},
  ],
};

export function slidesBibleItem(): SlidesItem {
  const item = slidesItem('blank');
  const [first, picture, last] = item.slides.slides;
  if (first === undefined || picture === undefined || last === undefined) {
    throw Error('Missing slide fixture');
  }
  const verse = {
    translation: SLIDES_PASSAGE.translation,
    book: 43,
    chapter: 3,
    verse: 16,
  };
  return {
    ...item,
    slides: {
      ...item.slides,
      slides: [
        first,
        {id: VERSE_SLIDE, verse},
        {id: VERSE_NEXT, verse: {...verse, verse: 17}},
        picture,
        {id: VERSE_REPEAT, verse},
        last,
      ],
    },
  };
}

export function slidesBiblePassages(item = slidesBibleItem()) {
  return new Map(
    item.slides.slides.flatMap(slide =>
      'verse' in slide ? [[slide.id, SLIDES_PASSAGE] as const] : [],
    ),
  );
}

export function renderedVerseSlides(parts = 2): readonly ShowTile[] {
  return projectSlides(slidesBibleItem()).flatMap((tile): ShowTile[] => {
    const {verse, ...plain} = tile;
    if (verse === undefined) return [plain];
    const count = verse.reference.verse === 16 ? parts : 1;
    return Array.from({length: count}, (_, index) => ({
      ...plain,
      lines: [index + 1 < count ? '가나 다라 (계속)' : '가나 다라'],
      biblePart: index + 1,
      continued: index + 1 < count,
    }));
  });
}
