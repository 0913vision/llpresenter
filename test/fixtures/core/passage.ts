import * as v from 'valibot';
import {bibleLookupPassageSchema} from '@core/schema/bibleLookup';

/** A passage of the first chapter of Genesis, from verses with texts. */
export function genesisPassage(
  verses: ReadonlyArray<readonly [verse: number, text: string]>,
) {
  const ref = `창세기 1:${verses.map(([verse]) => verse).join('-')}`;
  return v.parse(bibleLookupPassageSchema, {
    translation: 'krv',
    translationLabel: '개역한글',
    ref,
    displayRef: ref,
    verses: verses.map(([verse, text]) => ({chapter: 1, verse, text})),
  });
}
