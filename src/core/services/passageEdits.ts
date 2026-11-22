import {
  verseKey,
  versesOfPassage,
  type VerseReference,
} from '../bible/bibleTiles';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {
  BiblePassage,
  BibleSlide,
  BibleSlides,
} from '../schema/biblePassage';
import {createSlideId, type SlideId} from '../schema/ids';
import {
  isItemOfKind,
  type ServiceItem,
  type ServiceItemOf,
} from '../schema/service';
import type {SlideTransition} from '../schema/slideTransition';

export type PassageItem = ServiceItemOf<'bible' | 'sermon'>;

export function isPassageItem(item: ServiceItem): item is PassageItem {
  return isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon');
}

export function passageOf(item: PassageItem): BiblePassage {
  return isItemOfKind(item, 'sermon') ? item.sermon.passage : item.bible;
}

export function withPassage(
  item: PassageItem,
  passage: BiblePassage,
): PassageItem {
  return isItemOfKind(item, 'sermon')
    ? {...item, sermon: {...item.sermon, passage}}
    : {...item, bible: passage};
}

export function newBibleSlide(
  text: string,
  transition?: SlideTransition,
): BibleSlide {
  return {
    id: createSlideId(crypto.randomUUID()),
    text,
    ...(transition === undefined ? {} : {transition}),
  };
}

/** Keeps a slide for every verse, so each of them can be edited. */
export function keptSlides(
  passage: BiblePassage,
  lookup: BibleLookupPassage,
): BibleSlides {
  return Object.fromEntries(
    versesOfPassage(lookup).map(({reference, text}) => {
      const key = verseKey(reference);
      return [
        key,
        passage.slides?.[key] ?? [
          newBibleSlide(text.trim(), passage.transition),
        ],
      ];
    }),
  );
}

/** Changes the kept slides with these ids; null removes one. */
export function changeBibleSlides(
  slides: BibleSlides,
  ids: ReadonlySet<string>,
  change: (slide: BibleSlide) => BibleSlide | null,
): BibleSlides {
  return Object.fromEntries(
    Object.entries(slides).map(([key, verse]) => [
      key,
      verse.some(slide => ids.has(slide.id))
        ? verse.flatMap(slide => {
            const next = ids.has(slide.id) ? change(slide) : slide;
            return next === null ? [] : [next];
          })
        : verse,
    ]),
  );
}

/** Cuts a verse into these texts; each earlier slide keeps its settings. */
export function cutVerse(
  slides: BibleSlides,
  reference: VerseReference,
  {
    texts,
    transition,
  }: {
    readonly texts: readonly string[];
    readonly transition?: SlideTransition | undefined;
  },
): BibleSlides {
  const key = verseKey(reference);
  const before = slides[key] ?? [];
  return {
    ...slides,
    [key]: texts.map((text, index) => {
      const earlier = before[index];
      return earlier === undefined
        ? newBibleSlide(text, transition)
        : {...earlier, text};
    }),
  };
}

/** The whole text of a verse as its slides show it, with typed line breaks. */
export function verseText(
  slides: BibleSlides | undefined,
  reference: VerseReference,
  text: string,
): string {
  const kept = slides?.[verseKey(reference)];
  return kept === undefined || kept.length === 0
    ? text
    : kept.map(slide => slide.text.trimEnd()).join(' ');
}

/** The ids of the kept slides a set of tiles shows. */
export function slideIds(
  tiles: ReadonlyArray<{readonly sourceSlideId?: SlideId}>,
): ReadonlySet<string> {
  return new Set(
    tiles.flatMap(tile =>
      tile.sourceSlideId === undefined ? [] : [tile.sourceSlideId],
    ),
  );
}
