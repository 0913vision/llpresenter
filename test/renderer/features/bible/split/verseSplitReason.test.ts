import {expect, it} from 'vitest';
import {verseSplitReason} from '@renderer/features/bible/split/verseSplitReason';
import {genesisPassage} from '@fixtures/core/passage';
import {slideOf, verseOf} from '@fixtures/core/slides';

const TEXT = '태초에 하나님이 천지를 창조하시니라';
const passage = genesisPassage([[1, TEXT]]);

function deckOf(text: string, readOnly = false) {
  return {
    readOnly,
    slides: [slideOf(1, 'scripture', {texts: {본문: text}, verse: verseOf(1)})],
  };
}

it('cuts a verse whose slides hold its own text', () => {
  expect(verseSplitReason(deckOf(TEXT), verseOf(1), passage)).toBeUndefined();
});

it('says why a verse can not be cut now', () => {
  expect(verseSplitReason(null, verseOf(1), passage)).toBe(
    '말씀 슬라이드를 고르십시오.',
  );
  expect(verseSplitReason(deckOf(TEXT), undefined, passage)).toBe(
    '말씀 슬라이드를 고르십시오.',
  );
  expect(verseSplitReason(deckOf(TEXT, true), verseOf(1), passage)).toBe(
    '지금은 편집할 수 없습니다.',
  );
  expect(verseSplitReason(deckOf(TEXT), verseOf(1), null)).toBe(
    '본문을 불러오는 중입니다.',
  );
  expect(verseSplitReason(deckOf(TEXT), verseOf(5), passage)).toBe(
    '이 절의 본문을 찾을 수 없습니다.',
  );
  expect(verseSplitReason(deckOf('직접 바꾼 글'), verseOf(1), passage)).toBe(
    '직접 고친 절은 여기서 나눌 수 없습니다.',
  );
});
