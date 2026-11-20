import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {TranslationId} from '../schema/ids';
import type {BiblePassage} from '../schema/biblePassage';
import {bibleVerseTiles} from './bibleTiles';
import type {SlideTile} from '../presentation/model';
import type {SlideTransition} from '../schema/slideTransition';
import {textHash} from './split/splitCache';

export interface BibleDisplayOptions {
  readonly verseNumbers: boolean;
  readonly translationName?: boolean | undefined;
  /** Which slides show the reference; every slide when absent, as before. */
  readonly reference?: BiblePassage['reference'] | undefined;
}

export interface BiblePreviewOptions extends BibleDisplayOptions {
  readonly transition?: SlideTransition | undefined;
  readonly review?: boolean | undefined;
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

const passageHashes = new WeakMap<BibleLookupPassage, string>();

/** Picture identity follows the resolved passage and its display options. */
export function biblePassagePictureKey(source: BibleSource): string {
  const {passage} = source;
  let verses = passageHashes.get(passage);
  if (verses === undefined) {
    verses = textHash(JSON.stringify(passage.verses));
    passageHashes.set(passage, verses);
  }
  return JSON.stringify([
    passage.translation,
    passage.ref,
    passage.displayRef,
    passage.translationLabel,
    verses,
    source.verseNumbers,
    source.reference,
    source.translationName,
  ]);
}

export function bibleSource(
  passage: BibleLookupPassage,
  options: BiblePreviewOptions = {verseNumbers: true},
): BibleSource {
  const id = `bible:${passage.translation}:${passage.ref}`;
  const {verseNumbers, translationName = false} = options;
  const reference = options.reference ?? 'every';
  return {
    id: [
      id,
      verseNumbers ? '' : 'plain',
      reference === 'every' ? '' : reference,
      translationName ? 'translation' : '',
    ]
      .filter(part => part !== '')
      .join(':'),
    passage,
    verseNumbers,
    reference,
    translationName,
    review: options.review ?? true,
    ...(options.transition === undefined
      ? {}
      : {transition: options.transition}),
    ...(options.enteredRef === undefined
      ? {}
      : {enteredRef: options.enteredRef}),
    ...(options.enteredTranslation === undefined
      ? {}
      : {enteredTranslation: options.enteredTranslation}),
    tiles: bibleVerseTiles(passage, {
      verseNumbers,
      reference,
      translationName,
      transition: options.transition,
    }),
  };
}
