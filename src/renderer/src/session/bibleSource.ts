import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import type {Slide} from '@core/schema/slide';
import type {SlideTransition} from '@core/schema/slideTransition';
import type {SlideTile} from '@core/presentation';
import {slideTiles} from '@core/slides';

/** How a passage opened by itself is made into slides. */
export interface BibleDisplay {
  readonly verseNumbers: boolean;
  readonly translationName?: boolean | undefined;
  readonly transition?: SlideTransition | undefined;
  readonly review?: boolean | undefined;
  readonly enteredRef?: string | undefined;
  readonly enteredTranslation?: TranslationId | undefined;
}

/** A passage opened in 진행 without an item of the 예배 순서. */
export interface BibleSource extends BibleDisplay {
  readonly id: string;
  readonly passage: BibleLookupPassage;
  readonly slides: readonly Slide[];
  readonly tiles: readonly SlideTile[];
  readonly insertion?: {
    readonly serviceId: string | null;
    readonly itemId: string | null;
  };
}

/** A passage with the slides made for it. */
export function bibleSource(
  id: string,
  passage: BibleLookupPassage,
  {slides, ...display}: BibleDisplay & {readonly slides: readonly Slide[]},
): BibleSource {
  return {
    ...display,
    id,
    passage,
    slides,
    tiles: slideTiles(slides, {
      kind: 'bible',
      title: passage.displayRef,
      passage: passage.displayRef,
    }),
  };
}
