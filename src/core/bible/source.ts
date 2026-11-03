import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {TranslationId} from '../schema/ids';
import type {BiblePassage} from '../schema/biblePassage';
import {bibleVerseTiles} from './bibleTiles';
import type {SlideTile} from '../presentation/model';

export interface BibleDisplayOptions {
  readonly verseNumbers: boolean;
  /** Which slides show the reference; every slide when absent, as before. */
  readonly reference?: BiblePassage['reference'] | undefined;
}

export interface BiblePreviewOptions extends BibleDisplayOptions {
  readonly enteredRef?: string | undefined;
  readonly enteredTranslation?: TranslationId | undefined;
}

export interface BibleSource extends BiblePreviewOptions {
  readonly reference: BiblePassage['reference'];
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
  const reference = options.reference ?? 'every';
  return {
    id: [
      id,
      verseNumbers ? '' : 'plain',
      reference === 'every' ? '' : reference,
    ]
      .filter(part => part !== '')
      .join(':'),
    passage,
    verseNumbers,
    reference,
    ...(options.enteredRef === undefined
      ? {}
      : {enteredRef: options.enteredRef}),
    ...(options.enteredTranslation === undefined
      ? {}
      : {enteredTranslation: options.enteredTranslation}),
    tiles: bibleVerseTiles(passage, {verseNumbers, reference}),
  };
}
