import type {BibleLookupPassage} from '@shared/schema/bibleLookup';
import type {SlideTile} from '../model';

export interface BibleSource {
  readonly id: string;
  readonly passage: BibleLookupPassage;
  readonly tiles: readonly SlideTile[];
}

export function bibleSource(passage: BibleLookupPassage): BibleSource {
  return {
    id: `bible:${passage.translation}:${passage.ref}`,
    passage,
    tiles: passage.verses.map(verse => ({
      label: `${verse.chapter}:${verse.verse}`,
      labelColor: 'none',
      lines: [`${verse.verse} ${verse.text}`],
    })),
  };
}
