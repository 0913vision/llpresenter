import {passageBook} from './adjacentVerses';
import {NO_LABEL_COLOR} from '../labels/colors';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {BiblePassage, BibleSlides} from '../schema/biblePassage';
import {LIVE_STATE_LIMITS} from '../schema/liveLimits';
import type {ServiceItemOf, VerseSlide} from '../schema/service';
import type {ShowTile} from '../schema/showService';
import {CONT_MARKER} from './split/layout';

export type VerseReference = VerseSlide['verse'];

/** Names a verse in a passage's slides. */
export function verseKey({
  book,
  chapter,
  verse,
}: Pick<VerseReference, 'book' | 'chapter' | 'verse'>): string {
  return `${book}:${chapter}:${verse}`;
}

/** The verses of a looked-up passage, each with its full reference. */
export function versesOfPassage(
  passage: BibleLookupPassage,
): ReadonlyArray<{readonly reference: VerseReference; readonly text: string}> {
  const book = passageBook(passage);
  return book === undefined
    ? []
    : passage.verses.map(({chapter, verse, text}) => ({
        reference: {
          translation: passage.translation,
          book: book.id,
          chapter,
          verse,
        },
        text,
      }));
}

export function bibleOutputLines(text: string): readonly string[] {
  return text.split('\n').flatMap(line => {
    const pieces: string[] = [];
    let piece = '';
    for (const character of line) {
      if (piece.length + character.length > LIVE_STATE_LIMITS.textCharacters) {
        pieces.push(piece);
        piece = '';
      }
      piece += character;
    }
    pieces.push(piece);
    return pieces;
  });
}

/**
 * The chapter and verse at either end of a current or legacy slide label,
 * such as `3:34`, `3:34-36`, or `3:36-4:1`.
 */
export function labelEdge(
  label: string | null | undefined,
  edge: 'first' | 'last',
): string | undefined {
  const reference = label?.match(/\d+:\d+(?:[-~\uFF5E](?:\d+:)?\d+)?/u)?.[0];
  const [from, to] = reference?.split(/[-~\uFF5E]/u) ?? [];
  if (edge === 'first' || to === undefined) return from;
  return to.includes(':') ? to : `${from?.split(':')[0]}:${to}`;
}

/** How a passage becomes slides. */
export interface PassageOptions {
  readonly slides?: BibleSlides | undefined;
  /** Whether each verse starts with its number; true when absent. */
  readonly verseNumbers?: boolean;
  readonly translationName?: boolean | undefined;
  /** Which slides show the reference; none when absent. */
  readonly reference?: BiblePassage['reference'] | undefined;
  readonly transition?: BiblePassage['transition'] | undefined;
}

/**
 * The slides of a passage: those kept for each verse, or the whole verse on
 * one slide where none are kept. Every window and the output show these.
 */
export function passageTiles(
  passage: BibleLookupPassage,
  {
    slides,
    verseNumbers = true,
    translationName = false,
    reference: shown = 'none',
    transition,
  }: PassageOptions = {},
): readonly ShowTile[] {
  const book = passageBook(passage);
  const name = passage.displayRef.replace(/\s+\d.*$/u, '');
  const translation =
    translationName && passage.translationLabel
      ? ` (${passage.translationLabel})`
      : '';
  const numbered = verseNumbers && passage.verses.length > 1;
  const tiles = versesOfPassage(passage).flatMap(
    ({reference, text}): ShowTile[] => {
      const key = verseKey(reference);
      const kept = slides?.[key];
      const parts = kept ?? [{id: undefined, text: text.trim()}];
      const address = `${reference.chapter}:${reference.verse}`;
      return parts.map((part, index) => {
        const settings = kept?.[index];
        const continued = index < parts.length - 1;
        const effect = settings?.transition ?? transition;
        return {
          key: settings?.id ?? `verse:${key}`,
          ...(settings === undefined ? {} : {sourceSlideId: settings.id}),
          bibleVerse: reference,
          biblePart: index + 1,
          continued,
          label: `${book?.koreanShort ?? ''}${address}${parts.length > 1 ? ` (${index + 1})` : ''}`,
          ...(settings?.label === undefined
            ? {}
            : {slideLabel: settings.label}),
          labelColor: NO_LABEL_COLOR,
          ...(effect === undefined ? {} : {transition: effect}),
          reference: settings?.reference ?? `${name} ${address}${translation}`,
          ...(settings?.reference === undefined ? {} : {ownReference: true}),
          lines: bibleOutputLines(
            (index === 0 && numbered ? `${reference.verse} ` : '') +
              part.text.trimEnd() +
              (continued ? CONT_MARKER : ''),
          ),
        };
      });
    },
  );
  return tiles.map((tile, index) => {
    if (
      shown === 'every' ||
      (shown === 'first' && index === 0) ||
      (shown === 'last' && index === tiles.length - 1)
    ) {
      return tile;
    }
    const {reference: _reference, ...other} = tile;
    return other;
  });
}

export type SermonSide = 'opening' | 'closing';

/** The title slide of a sermon, before or after its passage. */
export function sermonTitleTile(
  sermon: ServiceItemOf<'sermon'>['sermon'],
  side: SermonSide,
  reference: string,
): ShowTile {
  const label = side === 'opening' ? sermon.openingLabel : sermon.closingLabel;
  const transition =
    side === 'opening' ? sermon.openingTransition : sermon.closingTransition;
  return {
    key: `sermon:${side}`,
    label: label ?? null,
    ...(label === undefined ? {} : {slideLabel: label}),
    labelColor: NO_LABEL_COLOR,
    lines: sermon.title.split(/\r?\n/),
    reference,
    sermonTitle: true,
    ...(transition === undefined ? {} : {transition}),
  };
}

/** A passage or sermon item's slides, with a sermon's title slides around it. */
export function bibleItemTiles(
  item: ServiceItemOf<'bible' | 'sermon'>,
  passage: BibleLookupPassage,
): readonly ShowTile[] {
  const sermon = 'sermon' in item ? item.sermon : undefined;
  const settings = 'sermon' in item ? item.sermon.passage : item.bible;
  const tiles = passageTiles(passage, settings);
  if (sermon === undefined) return tiles;
  return [
    ...(sermon.openingHidden
      ? []
      : [sermonTitleTile(sermon, 'opening', passage.displayRef)]),
    ...tiles,
    ...(sermon.closingHidden
      ? []
      : [sermonTitleTile(sermon, 'closing', passage.displayRef)]),
  ];
}
