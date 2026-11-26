import {afterEach, expect, it, vi} from 'vitest';
import type {Translation} from '@core/schema/bible/bible';
import * as v from 'valibot';
import {translationIdSchema} from '@core/schema/common/ids';
import {genesisPassage} from '@fixtures/core/passage';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {lyricsSlide} from '@fixtures/core/slides';
import {makePassageSlides} from '@renderer/features/bible/makePassageSlides';
import {
  newBibleItem,
  newSermonItem,
  passageSettingsOf,
} from '@renderer/features/service/items/passageItems';

vi.mock('@renderer/features/bible/makePassageSlides', () => ({
  makePassageSlides: vi.fn(),
}));

function translationId(value: string) {
  return v.parse(translationIdSchema, value);
}

const KRV = translationId('krv');
const translations: readonly Translation[] = [
  {id: KRV, name: '개역한글', lang: 'ko', file: 'krv.llbible', default: true},
  {
    id: translationId('niv'),
    name: 'NIV',
    lang: 'en',
    file: 'niv.llbible',
    default: false,
  },
];
const passage = genesisPassage([[1, '태초에 하나님이 천지를 창조하시니라']]);
const defaults = {translation: KRV, translations, verseNumbers: true};

afterEach(() => {
  delete window.llp;
  vi.mocked(makePassageSlides).mockReset();
});

it('starts a passage with the 절 번호 of 환경설정, hiding the name of the 기본 역본 only', () => {
  expect(passageSettingsOf(passage, defaults)).toEqual({
    translation: KRV,
    ref: passage.ref,
    verseNumbers: true,
    translationName: false,
  });
  const other = {...passage, translation: translationId('niv')};
  expect(
    passageSettingsOf(other, {...defaults, verseNumbers: false}),
  ).toMatchObject({verseNumbers: false, translationName: true});
});

it('makes a Bible item and a sermon item of the passage slides', async () => {
  window.llp = mockLlpApi();
  const slides = [lyricsSlide(1, '태초에')];
  vi.mocked(makePassageSlides).mockResolvedValue(slides);
  const bible = await newBibleItem(passage, defaults);
  expect(bible).toMatchObject({kind: 'bible', slides});
  const sermon = await newSermonItem('창조', passage, defaults);
  expect(sermon?.kind).toBe('sermon');
  expect(JSON.stringify(sermon)).toContain('창조');
});

it('makes no item when the slides were not settled or the window has no app', async () => {
  vi.mocked(makePassageSlides).mockResolvedValue(null);
  expect(await newBibleItem(passage, defaults)).toBeNull();
  window.llp = mockLlpApi();
  expect(await newBibleItem(passage, defaults)).toBeNull();
  expect(await newSermonItem('창조', passage, defaults)).toBeNull();
});
