import {expect, it} from 'vitest';
import type {Translation} from '@core/schema/bible/bible';
import * as v from 'valibot';
import {translationIdSchema} from '@core/schema/common/ids';
import {genesisPassage} from '@fixtures/core/passage';
import {passageSettingsOf} from '@renderer/features/service/items/passageItems';

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
