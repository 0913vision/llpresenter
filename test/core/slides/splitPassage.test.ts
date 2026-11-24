import {expect, it} from 'vitest';
import {
  cutBy,
  isCutOfVerse,
  slidesOfVerse,
  splitPassage,
} from '@core/slides/splitPassage';
import {passageSlides, versesOfPassage} from '@core/slides/passageSlides';
import {mockSplitLayout} from '@fixtures/core/bibleSplit';
import {genesisPassage} from '@fixtures/core/passage';
import {slideOf, verseOf} from '@fixtures/core/slides';
import {themes} from '@fixtures/core/themeOutput';
import {defaultSlideTransitions} from '@core/schema/app/preferences';

const LONG =
  '가나다라 마바사아 자차카타 파하가나 다라마바 사아자차 카타파하 가나다라';
const passage = genesisPassage([
  [1, '짧은 절'],
  [2, LONG],
]);
const layout = mockSplitLayout(10, 2);
const making = {themes: themes(), transitions: defaultSlideTransitions};

function verse(number: number) {
  const found = versesOfPassage(passage)[number - 1];
  if (found === undefined) throw new Error('No verse');
  return found;
}
function part(number: number, verseNumber: number, text: string) {
  return slideOf(number, 'scripture', {
    texts: {본문: text},
    verse: verseOf(verseNumber),
  });
}

it('cuts only the verses that do not fit, between words', () => {
  const split = splitPassage(passage, {layout, verseNumbers: true});
  const parts = split.parts.filter(entry => entry.reference.verse === 2);
  expect(split.parts.filter(entry => entry.reference.verse === 1)).toHaveLength(
    1,
  );
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.map(entry => entry.text.trim()).join(' ')).toBe(LONG);
  expect(parts.map(entry => entry.continued)).toEqual([
    ...parts.slice(1).map(() => true),
    false,
  ]);
});

it('numbers verses only when there is more than one', () => {
  expect(splitPassage(passage, {layout, verseNumbers: true}).numbered).toBe(
    true,
  );
  const one = genesisPassage([[1, '짧은 절']]);
  expect(splitPassage(one, {layout, verseNumbers: true}).numbered).toBe(false);
  expect(splitPassage(passage, {layout, verseNumbers: false}).numbered).toBe(
    false,
  );
});

it('keeps the cuts a verse already has', () => {
  const slides = [
    part(1, 2, '2 가나다라 마바사아 자차카타 파하가나 다라마바'),
    part(2, 2, '사아자차 카타파하 가나다라'),
  ];
  const split = splitPassage(passage, {layout, slides, verseNumbers: true});
  expect(
    split.parts
      .filter(entry => entry.reference.verse === 2)
      .map(entry => entry.text),
  ).toEqual([
    '가나다라 마바사아 자차카타 파하가나 다라마바',
    '사아자차 카타파하 가나다라',
  ]);
});

it('makes slides of the parts, of which all but the last go on', () => {
  const split = splitPassage(passage, {layout, verseNumbers: true});
  const slides = passageSlides(making, {
    passage,
    settings: {verseNumbers: true, translationName: false},
    cut: cutBy(split),
    before: [],
  });
  const own = slidesOfVerse(slides, verseOf(2));
  expect(own.map(slide => slide.continued ?? false)).toEqual([
    ...own.slice(1).map(() => true),
    false,
  ]);
  expect(own[0]?.texts['본문']?.startsWith('2 ')).toBe(true);
  expect(own[1]?.texts['본문']?.startsWith('2 ')).toBe(false);
  expect(isCutOfVerse(slides, verse(2))).toBe(true);
});

it('knows a verse that was changed by hand beyond its cuts', () => {
  const cut = [part(1, 2, `2 ${LONG.slice(0, 9)}`), part(2, 2, LONG.slice(10))];
  expect(isCutOfVerse(cut, verse(2))).toBe(true);
  expect(isCutOfVerse([part(1, 2, '다른 글')], verse(2))).toBe(false);
});

it('leaves a verse whole that it has no parts for', () => {
  expect(cutBy({parts: []})('본문', verseOf(3))).toEqual(['본문']);
});
