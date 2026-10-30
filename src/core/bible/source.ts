import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {TranslationId} from '../schema/ids';
import {bibleVerseTiles} from './bibleTiles';
import type {SlideTile} from '../presentation/model';

export interface BibleDisplayOptions {
  readonly verseNumbers: boolean;
}

export interface BiblePreviewOptions extends BibleDisplayOptions {
  readonly enteredRef?: string | undefined;
  readonly enteredTranslation?: TranslationId | undefined;
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
    ...(options.enteredTranslation === undefined
      ? {}
      : {enteredTranslation: options.enteredTranslation}),
    tiles: bibleVerseTiles(passage, verseNumbers, 'every'),
  };
}
