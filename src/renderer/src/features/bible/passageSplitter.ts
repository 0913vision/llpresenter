import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {BibleSlides} from '@core/schema/biblePassage';
import type {BibleCutsFile} from '@core/schema/bibleCuts';
import type {ThemeId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';
import type {ThemesFile} from '@core/schema/themes';
import {splitPassage, type PassageSplit} from '@core/bible/split/splitPassage';
import {slideTheme} from '@renderer/platform/useSlideTheme';
import {
  bibleMeasure,
  type BibleFontMeasure,
  type BibleTextElement,
} from '@renderer/rendering/bibleMeasure';

export type BibleAppearance = NonNullable<ReturnType<typeof slideTheme>>;

/** A passage cut for the text box of its theme on the audience screen. */
export interface BibleSplit extends PassageSplit {
  readonly element: BibleTextElement;
  readonly appearance: BibleAppearance;
}

export interface SplitRequest {
  readonly verseNumbers: boolean;
  readonly slides?: BibleSlides | undefined;
  readonly theme?: ThemeId | undefined;
  readonly source?: 'service' | 'external';
  /** Whether a verse that was cut by hand before is cut the same way again. */
  readonly remember?: boolean;
}

/** Cuts passages with the themes, screens and fonts of one moment. */
export class PassageSplitter {
  constructor(
    private readonly context: {
      readonly themes: ThemesFile;
      readonly screens: readonly Screen[];
      readonly saved: BibleCutsFile | undefined;
      readonly canvas: BibleFontMeasure;
    },
  ) {}

  split(
    passage: BibleLookupPassage,
    {
      verseNumbers,
      slides,
      theme,
      source = 'service',
      remember = true,
    }: SplitRequest,
  ): BibleSplit | null {
    const appearance = slideTheme(
      {
        kind: 'bible',
        id: 'passage',
        title: passage.displayRef,
        ...(theme === undefined
          ? {}
          : {
              bible: {
                translation: passage.translation,
                ref: passage.ref,
                theme,
              },
            }),
      },
      {
        source,
        file: this.context.themes,
        screens: this.context.screens,
      },
    );
    const element = appearance?.layout.elements.find(
      (candidate): candidate is BibleTextElement =>
        candidate.kind === 'currentText',
    );
    if (appearance === undefined || element === undefined) return null;
    const split = splitPassage(passage, {
      layout: bibleMeasure(element, this.context.canvas),
      saved: remember ? this.context.saved : undefined,
      slides,
      verseNumbers,
    });
    return split.parts.some(part => part.problem !== undefined)
      ? null
      : {...split, element, appearance};
  }
}

let current: PassageSplitter | null = null;

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
