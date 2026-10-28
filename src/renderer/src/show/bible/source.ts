import type {BibleLookupPassage} from '@shared/schema/bibleLookup';
import {bibleVerseTiles} from '@shared/bibleTiles';
import type {SlideTile} from '../model';

export interface BibleDisplayOptions {
  readonly verseNumbers: boolean;
}

export interface BiblePreviewOptions extends BibleDisplayOptions {
  readonly enteredRef?: string | undefined;
}

export interface BibleSource extends BiblePreviewOptions {
  readonly id: string;
  readonly passage: BibleLookupPassage;
  readonly tiles: readonly SlideTile[];
  readonly insertion?: {
    readonly serviceId: string | null;
    readonly itemId: string | null;
  };
}

export function bibleSource(
  passage: BibleLookupPassage,
  options: BiblePreviewOptions = {verseNumbers: true},
): BibleSource {
  const id = `bible:${passage.translation}:${passage.ref}`;
  const {verseNumbers} = options;
  return {
    id: verseNumbers ? id : `${id}:plain`,
    passage,
    verseNumbers,
    ...(options.enteredRef === undefined
      ? {}
      : {enteredRef: options.enteredRef}),
    tiles: bibleVerseTiles(passage, verseNumbers, 'every'),
  };
}
