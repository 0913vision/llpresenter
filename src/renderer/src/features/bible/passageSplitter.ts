import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import type {BibleCutsFile} from '@core/schema/bible/bibleCuts';
import type {ThemeId} from '@core/schema/common/ids';
import type {Slide} from '@core/schema/slides/slide';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {splitPassage, type PassageSplit} from '@core/slides';
import {themeFor, themeOf} from '@core/theme';
import {
  elementOfBox,
  splitLayoutOf,
  type FontMeasure,
} from '@renderer/rendering/theme/splitMeasure';

/** A passage cut for the text box of its theme on 청중. */
export interface BibleSplit extends PassageSplit {
  readonly theme: ThemeFile;
  /** The address its slides show. */
  readonly address: string;
}

/** What a split of one passage needs besides the passage itself. */
export interface SplitRequest {
  readonly verseNumbers: boolean;
  /** Slides that some of the verses have already. */
  readonly slides?: readonly Slide[] | undefined;
  /** The theme of the slides, when it isn't the one for new ones. */
  readonly theme?: ThemeId | undefined;
}

/** Cuts passages with the themes and fonts of one moment. */
export class PassageSplitter {
  constructor(
    private readonly context: {
      readonly themes: Themes;
      readonly saved: BibleCutsFile | undefined;
      readonly canvas: FontMeasure;
    },
  ) {}

  split(
    passage: BibleLookupPassage,
    {verseNumbers, slides, theme: own}: SplitRequest,
  ): BibleSplit | null {
    const {themes, saved, canvas} = this.context;
    const theme =
      (own === undefined ? undefined : themeOf(themes, own)) ??
      themeFor(themes, 'scripture');
    const element = elementOfBox(theme, '본문');
    if (element === undefined) return null;
    const split = splitPassage(passage, {
      layout: splitLayoutOf(element, canvas),
      saved,
      ...(slides === undefined ? {} : {slides}),
      verseNumbers,
    });
    return split.parts.some(part => part.problem !== undefined)
      ? null
      : {...split, theme, address: passage.displayRef};
  }
}

let current: PassageSplitter | null = null;

/**
 * Makes `splitter` the one that passageSplitter() returns, and returns a
 * function that removes it again.
 */
export function installPassageSplitter(
  splitter: PassageSplitter | null,
): () => void {
  current = splitter;
  return () => {
    if (current === splitter) current = null;
  };
}

/** The splitter in use, for a passage opened outside a component. */
export function passageSplitter(): PassageSplitter | null {
  return current;
}
